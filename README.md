# Naver Works Calculator

Naver Works(웍스모바일) 근로시간 화면에 **총 추가 근로 시간**(반차 포함 / 제외)을 표시하고,
월별 근로시간을 CSV 로 내려받을 수 있게 해주는 Tampermonkey 유저스크립트.

- 근무 통계 페이지(`*.worksmobile.com/my-space/work-statistics`): 상단 요약 박스에 합계 2줄 추가 + `csv 다운로드` 버튼
- 홈(`home.worksmobile.com`): "나의 근로 시간" 위젯에 합계 박스 주입

표시하는 두 값은 이렇게 나뉩니다.

| 표시 | 의미 |
| --- | --- |
| **전체** | 이번 달 전체 합계. 오늘 이후에 미리 등록해 둔 반차/반반차 예정까지 반영된, 이대로 가면 월말에 서게 될 값 |
| **오늘까지** | 오늘 날짜까지만 잘라서 합산. 미래 예정분이 섞이지 않은 "지금 시점" 값 |

> 0.0.19 이전에는 두 번째 값이 "근로시간이 정확히 2시간/4시간인 날을 빼고 합산"이었습니다.
> 미래에 등록해 둔 반차뿐 아니라 이미 지나간 반차까지 빼버려서 실제 잔여 시간과 어긋났기 때문에,
> 날짜 기준으로 자르는 방식으로 바꿨습니다.

## 설치

Greasy Fork 에서 설치합니다 (Tampermonkey 필요):

**https://greasyfork.org/en/scripts/505884-naver-works-calculator**

설치 후에는 Tampermonkey 가 Greasy Fork 를 통해 자동으로 업데이트합니다.

## 배포 흐름

```
 로컬 수정 → npm run bump → git push (main)
     → GitHub Actions: 문법/메타데이터/버전 검증 + 태그·릴리스 생성
     → Greasy Fork 가 raw URL 을 주기적으로 읽어 새 버전 게시
     → 사용자 Tampermonkey 자동 업데이트
```

`@downloadURL` / `@updateURL` 은 Greasy Fork 를 가리키므로 기존 설치자는 그대로 유지됩니다.

### Greasy Fork 자동 동기화 설정 (최초 1회)

1. https://greasyfork.org/en/scripts/505884-naver-works-calculator/admin 접속
2. **Sync** 탭 → *Sync type* 을 `Automatic` 으로 선택
3. *Source URL* 에 아래 raw 주소 입력

   ```
   https://raw.githubusercontent.com/ttop32/naver-works-calculator/main/naver-works-calculator.user.js
   ```

4. 저장

이후 Greasy Fork 가 주기적으로(보통 하루 1회) 원본을 확인해 버전이 올라갔으면 새 버전을 게시합니다.
즉시 반영하고 싶으면 같은 Sync 탭의 **Update from source** 버튼을 누릅니다.

> 주의: Greasy Fork 는 `@version` 이 **올라간 경우에만** 새 버전으로 인정합니다.
> 그래서 CI 가 "스크립트는 바뀌었는데 버전이 그대로"인 커밋을 실패시킵니다.

## 개발

```bash
npm run validate    # 문법 + 메타데이터 검사
npm run bump        # 0.0.18 -> 0.0.19 (patch)
npm run bump:minor  # 0.0.18 -> 0.1.0
npm run bump:major  # 0.0.18 -> 1.0.0
```

로컬에서 테스트할 때는 Tampermonkey 대시보드에서 이 저장소의 `naver-works-calculator.user.js`
내용을 붙여넣어 별도 스크립트로 저장하고, Greasy Fork 판은 잠시 비활성화하면 편합니다.

### 커밋 절차

```bash
npm run validate && npm run bump
git add -A && git commit -m "설명" && git push
```

## 라이선스

MIT
