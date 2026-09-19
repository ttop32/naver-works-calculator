// ==UserScript==
// @name         Naver Works Calculator
// @namespace    http://tampermonkey.net/
// @version      0.0.18
// @description  Calculate total work remain time
// @author       K
// @match        *://*.worksmobile.com/my-space/work-statistics
// @match        *://home.worksmobile.com/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @connect      workplace.worksmobile.com
// @license      MIT
// @run-at       document-end
// @downloadURL https://update.greasyfork.org/scripts/505884/Naver%20Works%20Calculator.user.js
// @updateURL https://update.greasyfork.org/scripts/505884/Naver%20Works%20Calculator.meta.js
// ==/UserScript==

(async function () {
    'use strict';

    /* ===============================
     * constants
     * =============================== */
    const BASE_WORK_MINUTES = 480; // 8시간
    const HALF_DAY_OFF_MINUTES = [120, 240]; // 반차 / 반반차
    const WORKPLACE_ORIGIN = 'https://workplace.worksmobile.com';
    const HOME_BOX_ID = 'nw-calc-home-box';

    const isHomePage = location.hostname === 'home.worksmobile.com';

    /* ===============================
     * utils
     * =============================== */
    const getWorkUrl = (origin, userId, fromDate, toDate) =>
        `${origin}/my-space/work-statistics/list?fromDate=${fromDate}&toDate=${toDate}&empId=${userId}&chkWorkingDay=N&_=${Date.now()}`;

    const formatTime = (totalDiff) => {
        const sign = totalDiff < 0 ? '-' : '+';
        const hours = Math.floor(Math.abs(totalDiff) / 60);
        const minutes = Math.abs(totalDiff) % 60;
        return `${sign}${hours}시간 ${minutes}분`;
    };

    // 홈 위젯용 컴팩트 포맷: 네이티브 표기(08:37)와 동일한 H:MM, 부호 포함 (+12:30)
    const formatSignedHM = (totalDiff) => {
        const sign = totalDiff < 0 ? '-' : '+';
        const abs = Math.abs(totalDiff);
        const h = Math.floor(abs / 60);
        const m = abs % 60;
        return `${sign}${h}:${String(m).padStart(2, '0')}`;
    };

    // 사용 가능한 GM xmlHttpRequest 핸들 (구형 GM_xmlhttpRequest / 신형 GM.xmlHttpRequest)
    const gmRequest =
        (typeof GM_xmlhttpRequest === 'function') ? GM_xmlhttpRequest :
        (typeof GM !== 'undefined' && GM && typeof GM.xmlHttpRequest === 'function')
            ? GM.xmlHttpRequest.bind(GM)
            : null;

    // Cross-origin friendly GET → JSON.
    // GM_xmlhttpRequest 가 있으면 사용(CORS 우회 + 대상 도메인 쿠키 전송).
    // 없으면 same-origin 전용 fetch 로 폴백 (work-statistics 페이지에서만 유효).
    const getJson = (url) => new Promise((resolve, reject) => {
        if (gmRequest) {
            gmRequest({
                method: 'GET',
                url,
                withCredentials: true,
                headers: { Referer: `${WORKPLACE_ORIGIN}/my-space/work-statistics` },
                onload: (res) => {
                    if (res.status < 200 || res.status >= 300) {
                        reject(new Error(`HTTP ${res.status}`));
                        return;
                    }
                    try {
                        resolve(JSON.parse(res.responseText));
                    } catch (e) {
                        reject(e);
                    }
                },
                onerror: () => reject(new Error('GM xmlHttpRequest 네트워크 오류')),
            });
        } else {
            fetch(url, { credentials: 'include' })
                .then(r => r.json())
                .then(resolve)
                .catch(reject);
        }
    });

    /* ===============================
     * data
     * =============================== */
    const parseWorkTimes = (data) =>
        data.data.list
            .filter(item =>
                item.sumWorkTime &&
                item.sumWorkTime !== '0000' &&
                item.checkYmd !== 'TOTAL'
            )
            .map(item => {
                const hours = parseInt(item.sumWorkTime.substring(0, 2), 10);
                const minutes = parseInt(item.sumWorkTime.substring(2, 4), 10);
                const totalMinutes = hours * 60 + minutes;

                return {
                    checkYmd: new Date(
                        item.checkYmd.replace(
                            /(\d{4})(\d{2})(\d{2})/,
                            '$1-$2-$3'
                        )
                    ),
                    sumWorkTime: totalMinutes,
                    diff: totalMinutes - BASE_WORK_MINUTES
                };
            });

    const calculateTotalRemainWork = (workTimes) =>
        workTimes.reduce((acc, item) => acc + item.diff, 0);

    // 현재 월의 fromDate / toDate (YYYYMMDD)
    const getMonthRange = () => {
        const now = new Date();
        const fromDate =
            `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}01`;
        const toDate =
            `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}` +
            `${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;
        return { fromDate, toDate };
    };

    // workTimes → { workTimes, withHalfDayOff, withoutHalfDayOff }
    const computeTotals = (workTimes) => {
        const withHalfDayOff = calculateTotalRemainWork(workTimes);
        const withoutHalfDayOff = calculateTotalRemainWork(
            workTimes.filter(item => !HALF_DAY_OFF_MINUTES.includes(item.sumWorkTime))
        );
        return { workTimes, withHalfDayOff, withoutHalfDayOff };
    };

    const fetchWorkTimes = async (origin, userId) => {
        const { fromDate, toDate } = getMonthRange();
        return getJson(getWorkUrl(origin, userId, fromDate, toDate))
            .then(parseWorkTimes)
            .catch(err => {
                console.error('[NW Calculator]', err);
                return [];
            });
    };

    /* ===============================
     * dom (work-statistics page)
     * =============================== */
    const STAT_ROW_ID = 'nw-calc-stat-row';

    const findSearchRow = () =>
        document.querySelector('.search-wrap');

    const findFormRow = () =>
        document.querySelector('.form-group');

    // 상단 요약 박스(일평균 잔여 시간 / 산정 기간 내 누적 시간)의 본문
    const findSummaryBody = () =>
        document.querySelector('.box.border-box.type1 .box-body');

    // 네이티브 요약 행과 동일한 마크업(label + strong.text-blue, 2-컬럼)으로 생성 → 자연스럽게 녹아듦
    const createStatColumn = (label, value) => `
        <div class="col-6 p-0">
            <div class="form-group row mb-0">
                <label class="form-label type2 col-7 text-right ph-10">
                    <span style="font-weight: bold;">${label}</span>
                </label>
                <div class="row col-5">
                    <strong class="text-blue">${value}</strong>
                </div>
            </div>
        </div>`;

    const createTotalTimeRow = (withHalfDayOff, withoutHalfDayOff) => {
        const row = document.createElement('div');
        row.id = STAT_ROW_ID;
        row.className = 'row';
        row.style.marginTop = '8px';
        row.innerHTML =
            createStatColumn('총 추가 근로 시간 (반차 포함)', formatSignedHM(withHalfDayOff)) +
            createStatColumn('총 추가 근로 시간 (반차 제외)', formatSignedHM(withoutHalfDayOff));
        return row;
    };

    // 요약 박스를 못 찾을 때를 위한 폴백(기존 단순 박스)
    const createTotalTimeBox = (withHalfDayOff, withoutHalfDayOff) => {
        const el = document.createElement('div');
        el.className = 'colwrap-item searchStand p-5';
        el.innerHTML = `
            총 추가 근로 시간 :
            반차 포함 ${formatTime(withHalfDayOff)} /
            반차 제외 ${formatTime(withoutHalfDayOff)}
        `;
        return el;
    };
    const formatMinutesToHM = (minutes) => {
        const sign = minutes < 0 ? '-' : '';
        const abs = Math.abs(minutes);
        const h = Math.floor(abs / 60);
        const m = abs % 60;
        return `T ${sign}${h}:${String(m).padStart(2, '0')}`;
    };

    const createDownloadButton = (workTimes) => {
        const button = document.createElement('button');
        button.className = 'btn btn-md line-1'; // 옆의 '검색' 버튼과 동일 스타일
        button.style.marginLeft = '5px';
        button.textContent = 'csv 다운로드';

        button.addEventListener('click', () => {
            const now = new Date();
            const yearMonth =
                  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

            const csvHeader =
                  '날짜,총 근로 시간(분),차이(분),반차제외 근로시간(분),반차제외 차이(분)\n';

            let totalSumWorkTime = 0;
            let totalDiff = 0;
            let totalSumWorkTimeWithoutHalf = 0;
            let totalDiffWithoutHalf = 0;

            const csvBody = workTimes
            .map(item => {
                const date = item.checkYmd.toISOString().split('T')[0];

                totalSumWorkTime += item.sumWorkTime;
                totalDiff += item.diff;

                // 반차
                if (HALF_DAY_OFF_MINUTES.includes(item.sumWorkTime)) {
                    return `${date},${item.sumWorkTime},${item.diff},,`;
                }

                totalSumWorkTimeWithoutHalf += item.sumWorkTime;
                totalDiffWithoutHalf += item.diff;

                return `${date},${item.sumWorkTime},${item.diff},${item.sumWorkTime},${item.diff}`;
            })
            .join('\n');

            // ✅ 합산 (분)
            const footerMinutes =
                  `\n합계(분),${totalSumWorkTime},${totalDiff},` +
                  `${totalSumWorkTimeWithoutHalf},${totalDiffWithoutHalf}`;

            // ✅ 합산 (시간)
            const footerHours =
                  `\n합계(시간),` +
                  `${formatMinutesToHM(totalSumWorkTime)},` +
                  `${formatMinutesToHM(totalDiff)},` +
                  `${formatMinutesToHM(totalSumWorkTimeWithoutHalf)},` +
                  `${formatMinutesToHM(totalDiffWithoutHalf)}`;

            const csvContent =
                  '﻿' + csvHeader + csvBody + footerMinutes + footerHours;

            const link = document.createElement('a');
            link.href = encodeURI(`data:text/csv;charset=utf-8,${csvContent}`);
            link.download = `work_times_${yearMonth}.csv`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });

        return button;
    };

    const updateDOM = (workTimes, withHalfDayOff, withoutHalfDayOff) => {
        if (document.getElementById(STAT_ROW_ID)) return; // 중복 주입 방지

        findSearchRow()?.appendChild(createDownloadButton(workTimes));

        const summaryBody = findSummaryBody();
        if (summaryBody) {
            // 네이티브 요약 박스 안에 동일 스타일의 행 추가
            summaryBody.appendChild(createTotalTimeRow(withHalfDayOff, withoutHalfDayOff));
        } else {
            // 폴백: 기존 단순 박스
            findFormRow()?.appendChild(
                createTotalTimeBox(withHalfDayOff, withoutHalfDayOff)
            );
        }
    };

    /* ===============================
     * dom (home widget)
     * =============================== */
    // 홈의 "나의 근로 시간" 위젯(MyWorkingHours)에 총 추가 근로 시간 박스를 주입.
    // Vue 가 위젯을 다시 그려도 사라지지 않도록 주기적으로 보충한다.
    const injectHomeBox = (withHalfDayOff, withoutHalfDayOff) => {
        const widget = document.querySelector('[data-widget-component="MyWorkingHours"]');
        if (!widget) return false;

        const content = widget.querySelector('.widget_content');
        if (!content) return false;

        if (content.querySelector(`#${HOME_BOX_ID}`)) return true; // 이미 주입됨

        // 네이티브 클래스만 사용 → 위젯 기존 박스와 동일한 스타일/간격(.my_work_hours_box + .my_work_hours_box)
        // 고정 높이(260px) 위젯이 넘치지 않도록 제목 + 값 1줄로 압축, 값은 네이티브와 같은 H:MM 표기.
        const box = document.createElement('div');
        box.id = HOME_BOX_ID;
        box.className = 'my_work_hours_box';
        box.innerHTML = `
            <div class="my_work_hours">
                <div class="title">총 추가 근로 시간</div>
                <div class="work_hours">
                    <strong>${formatSignedHM(withHalfDayOff)}</strong><span>포함</span>
                    <strong style="margin-left:8px">${formatSignedHM(withoutHalfDayOff)}</strong><span>제외</span>
                </div>
            </div>`;

        const area = content.querySelector('.my_work_hours_area') || content;
        area.appendChild(box);
        return true;
    };

    // 홈 페이지에서 empId 조회 (window.__NUXT__.state.userId) — 폴백용
    const getHomeEmpId = () => {
        try {
            const w = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
            const s = w.__NUXT__ && w.__NUXT__.state;
            if (!s) return null;
            return s.userId || s.userIdNo || (s.user && s.user.userId) || null;
        } catch (e) {
            return null;
        }
    };

    // workplace work-statistics 페이지 HTML 에서 empId 추출.
    // → "되는" 워크플레이스 페이지와 100% 동일한 empId 를 사용하기 위함.
    const fetchEmpIdFromWorkplace = () => new Promise((resolve) => {
        gmRequest({
            method: 'GET',
            url: `${WORKPLACE_ORIGIN}/my-space/work-statistics`,
            withCredentials: true,
            onload: (res) => {
                const m = res.responseText.match(/empId:\s*'([^']+)'/);
                resolve(m ? m[1] : null);
            },
            onerror: () => resolve(null),
        });
    });

    /* ===============================
     * main
     * =============================== */
    if (isHomePage) {
        // ---- 홈 페이지 ----
        // 홈 → workplace 는 cross-origin 이라 GM_xmlhttpRequest 가 반드시 필요.
        if (!gmRequest) {
            console.error(
                '[NW Calculator] GM_xmlhttpRequest 를 사용할 수 없습니다.\n' +
                '홈 화면에서 동작하려면 Tampermonkey 에서 스크립트를 "재설치/저장"해 ' +
                '@grant GM_xmlhttpRequest 와 @connect workplace.worksmobile.com 권한을 적용해야 합니다.'
            );
            return;
        }

        // 워크플레이스 페이지와 동일 방식(HTML 의 empId)으로 먼저 시도, 실패 시 __NUXT__ 폴백
        const empId = (await fetchEmpIdFromWorkplace()) || getHomeEmpId();
        if (!empId) {
            console.warn('[NW Calculator] empId 를 찾지 못했습니다.');
            return;
        }
        console.log('[NW Calculator] empId:', empId);

        const workTimes = await fetchWorkTimes(WORKPLACE_ORIGIN, empId);
        const { withHalfDayOff, withoutHalfDayOff } = computeTotals(workTimes);

        console.log('[NW Calculator] Including half day off:', withHalfDayOff);
        console.log('[NW Calculator] Excluding half day off:', withoutHalfDayOff);

        // 위젯이 렌더링될 때까지 대기 + Vue 재렌더 대비 주기적 보충
        injectHomeBox(withHalfDayOff, withoutHalfDayOff);
        setInterval(
            () => injectHomeBox(withHalfDayOff, withoutHalfDayOff),
            1000
        );
        return;
    }

    // ---- work-statistics 페이지 (기존 동작) ----
    const getUserId = async () => {
        const html = await fetch(location.href).then(r => r.text());
        const match = html.match(/empId:\s*'([^']+)'/);
        return match?.[1];
    };

    const userId = await getUserId();
    if (!userId) return;

    const workTimes = await fetchWorkTimes(location.origin, userId);
    const { withHalfDayOff, withoutHalfDayOff } = computeTotals(workTimes);

    console.log('Including half day off:', withHalfDayOff);
    console.log('Excluding half day off:', withoutHalfDayOff);

    updateDOM(workTimes, withHalfDayOff, withoutHalfDayOff);

})();
