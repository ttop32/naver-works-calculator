네이버 웍스 근태 화면에 **이번 달 추가 근로 시간 합계**를 표시하고, 월별 근로시간을 CSV 로 내려받는 유저스크립트입니다.

## 무엇을 하나요

**홈 화면** (`home.worksmobile.com`) — "나의 근로 시간" 위젯 아래에 합계 박스를 붙입니다. 근태 페이지까지 들어가지 않아도 바로 보입니다.

**근무 통계 페이지** (`*.worksmobile.com/my-space/work-statistics`) — 상단 요약 박스에 합계 두 줄을 추가하고, 검색 버튼 옆에 `csv 다운로드` 버튼을 만듭니다.

## 표시되는 두 값

하루 기준 8시간을 기준선으로, 초과분은 `+`, 부족분은 `-` 로 누적합니다.

| 표시 | 의미 |
| --- | --- |
| **전체** | 이번 달 전체 합계. 오늘 이후에 미리 등록해 둔 반차/반반차 예정까지 반영된 값입니다. 이대로 가면 월말에 서게 될 숫자. |
| **오늘까지** | 오늘 날짜까지만 잘라서 합산한 값. 미래 예정분이 섞이지 않은 "지금 시점" 숫자. |

예를 들어 오늘까지 `+2:00` 을 쌓아뒀는데 다음 주에 반차가 하나 잡혀 있으면, **오늘까지**는 `+2:00` 그대로지만 **전체**는 `-2:00` 으로 보입니다.

## CSV 다운로드

근무 통계 페이지의 `csv 다운로드` 버튼을 누르면 `work_times_YYYY-MM.csv` 가 저장됩니다. 날짜별 근로시간(분)과 기준 대비 차이, 그리고 합계 행(분 단위 / 시간 단위)이 들어 있습니다. 엑셀에서 바로 열리도록 UTF-8 BOM 이 붙습니다.

## 설치

1. **Tampermonkey 설치** — [Chrome 웹스토어](https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
2. **개발자 모드 켜기** — Chrome 확장 프로그램 페이지(`chrome://extensions/`) 우측 상단의 "개발자 모드" 토글을 켭니다. Manifest V3 이후 이걸 켜야 유저스크립트가 실행됩니다.
3. **이 페이지에서 "이 스크립트 설치"** 클릭
4. 네이버 웍스 [홈](https://home.worksmobile.com/) 이나 근무 통계 페이지를 열면 합계가 표시됩니다.

## 동작하지 않을 때

- 홈 화면에서만 안 보인다면, Tampermonkey 대시보드에서 이 스크립트를 한 번 저장(재설치)해 `@grant GM_xmlhttpRequest` 와 `@connect workplace.worksmobile.com` 권한을 다시 적용해 보세요. 홈에서 근태 데이터를 가져오려면 교차 도메인 요청 권한이 필요합니다.
- 브라우저 콘솔에 `[NW Calculator]` 로 시작하는 로그가 찍히니 확인에 참고하세요.

## 소스

https://github.com/ttop32/naver-works-calculator — MIT

---

*English:* A userscript for Naver Works that shows your monthly overtime balance (relative to an 8h/day baseline) on both the home widget and the work statistics page, and adds a CSV export button. **전체 / Total** includes half-day leave already scheduled after today; **오늘까지 / Until today** counts only up to the current date. Requires Tampermonkey with developer mode enabled.
