# 💸 머니북 (money-book)

빠르게 입력하고 한눈에 보는 개인 가계부. 폰 홈 화면에 설치해서 앱처럼 쓰는 PWA입니다.

- **빠른 입력**: 금액 → 카테고리 → 저장, 3번 터치로 끝나요. 마지막으로 쓴 카테고리를 기억해요.
- **고정 항목**: 월세, 적금, 통신비를 날짜와 관련 계좌까지 등록해 두고, 매달 한 번에 반영해요.
- **차트**: 월별 수입/지출/저축, 카테고리별 지출, 지난달과 비교한 이번 달 지출 흐름
- **노션 가져오기**: 노션 가계부 내보내기 ZIP을 그대로 올리면 유형을 매핑하고 중복을 걸러서 가져와요.
- **데모 모드**: 로그인 없이 가짜 데이터로 둘러볼 수 있어요 (포트폴리오 방문자용).

## 구조

```
GitHub Pages (Next.js 정적 export)  ──►  Supabase (Auth + Postgres + RLS)
  화면만 담당, 코드 공개                    데이터는 본인 계정으로만 접근
```

GitHub Pages에는 서버가 없어서 비밀번호를 프런트엔드 코드로 확인하면 보안이 되지 않아요.
그래서 로그인과 데이터는 Supabase가 맡고, 행 단위 보안(RLS)으로 **본인 데이터만** 읽고 쓰게 했어요.

| 경로 | 화면 |
|---|---|
| `/` | 대시보드 (월 요약, 지출 흐름, 카테고리, 월별 현황) |
| `/add` | 빠른 입력 |
| `/history` | 월별 내역 · 검색 · 필터 · 수정 |
| `/recurring` | 고정 항목 관리 |
| `/import` | 노션 가져오기 |
| `/settings` | CSV 내보내기, 로그아웃 |

## 시작하기

```bash
npm install
npm run dev          # http://localhost:3000 → "데모 데이터로 둘러보기"
```

### 1. Supabase 연결

1. [supabase.com](https://supabase.com)에서 새 프로젝트 만들기
2. **SQL Editor**에 [`supabase/schema.sql`](supabase/schema.sql)을 붙여넣고 실행
3. **Authentication → Users → Add user**로 내 계정(이메일/비밀번호) 만들기
4. **Authentication → Sign In / Providers**에서 **Allow new users to sign up 끄기** (나만 쓰기)
5. `.env.example`을 `.env.local`로 복사하고 **Project Settings → API**의 URL과 anon(publishable) 키 넣기

anon 키는 브라우저에 공개되는 키라서 노출돼도 괜찮아요. 데이터는 RLS가 막아줘요. `service_role` 키는 절대 넣지 마세요.

### 2. GitHub Pages 배포

1. GitHub에 `money-book` 저장소를 만들고 push
2. 저장소 **Settings → Secrets and variables → Actions**에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 추가
3. **Settings → Pages → Source**를 **GitHub Actions**로 설정
4. `main`에 push하면 `https://<user>.github.io/money-book/`에 배포돼요

### 3. 폰 홈 화면에 추가

- 아이폰: Safari → 공유 → 홈 화면에 추가
- 안드로이드: Chrome → 메뉴 → 앱 설치

## 노션에서 가져오기

노션 가계부 페이지 → `⋯` → 내보내기 → **Markdown & CSV**, **하위 페이지 포함** → 받은 ZIP을 `/import`에 올리기.

- `내역 / 금액 / 유형 / 날짜 / 계좌번호 / 기타` 열을 자동으로 찾아요 (영문 열 이름도 가능).
- 날짜는 `January 24, 2026`, `2026년 1월 24일`, `2026/01/24` 형식을 모두 읽어요. 날짜가 비어 있으면 파일 이름(`26년 02월`)의 1일로 넣어요.
- `적금·청약·투자`는 저축, `월급·급여`는 수입으로 분류하고, 나머지는 지출로 넣어요. 가져오기 전에 유형별로 바꿀 수 있어요.

```bash
npx tsx scripts/test-import.mts   # 샘플 ZIP으로 파서 확인
```

## 기술 스택

Next.js 16 (App Router, static export) · React 19 · TypeScript · Tailwind CSS 4 · Supabase · Recharts · PapaParse · fflate
