# 💸 머니북 (money-book)

빠르게 입력하고 한눈에 보는 개인 가계부. 폰 홈 화면에 설치해서 앱처럼 쓰는 PWA입니다.

- **빠른 입력**: 금액 → 카테고리 → 저장, 3번 터치로 끝나요. 마지막으로 쓴 카테고리를 기억해요.
- **고정 항목**: 월세, 적금, 통신비를 날짜와 관련 계좌까지 등록해 두고, 매달 한 번에 반영해요.
- **차트**: 월별 수입/지출/저축, 카테고리별 지출, 지난달과 비교한 이번 달 지출 흐름
- **노션 가져오기**: 노션 가계부 내보내기 ZIP을 그대로 올리면 유형을 매핑하고 중복을 걸러서 가져와요.
- **데모 모드**: 로그인 없이 가짜 데이터로 둘러볼 수 있어요 (포트폴리오 방문자용).
- **카드값 모아보기**: 카드사 앱의 청구 화면을 분석하고 확인 후 저장해요. 카드사별 결제일과 월 청구액 합계를 홈에서 확인할 수 있어요.

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
| `/cards` | 카드사별 월 결제 예정금액 · 캡처 분석 · 직접 입력 |

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

## 카드값 모아보기 설정

이 기능은 **카드사별 월 청구 총액**을 관리합니다. 개별 거래는 생성하지 않고 기존 지출 합계와 별도로 표시합니다. 같은 카드사·결제 월로 저장하면 이전 값을 갱신합니다. 카드사 합계가 나온 화면을 사용하세요. 여러 카드의 개별 청구 화면을 같은 카드사로 저장하면 합산되지 않고 갱신됩니다.

### 데이터베이스

기존 Supabase 프로젝트의 SQL Editor에서 `supabase/migrations/202610140001_card_bills.sql`을 실행하세요. 새 프로젝트는 `supabase/schema.sql`에 포함되어 있습니다. 본인 데이터만 접근하도록 RLS를 적용합니다. 기존 거래/메모 테이블은 변경하지 않습니다.

### 이미지 분석 서버

GitHub Pages는 화면을 제공하고, Supabase Edge Function `analyze-card-bill`이 로그인 토큰을 검증한 뒤 OpenAI Responses API를 호출합니다. 분석 결과는 확인 폼에만 채워지며 사용자가 저장하기 전에는 DB에 기록하지 않습니다.

1. Supabase CLI로 로그인하고 해당 프로젝트를 연결합니다.

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```

2. Supabase Dashboard → Edge Functions → Secrets에서 `OPENAI_API_KEY`를 등록합니다. 선택 항목 `OPENAI_VISION_MODEL`의 기본값은 `gpt-4.1-mini`입니다. 이미지 입력과 Structured Outputs를 지원하는 모델을 사용하세요. 이 키는 프런트엔드 `.env`나 `NEXT_PUBLIC_*`에 넣지 않습니다.

3. 함수를 배포합니다. 로그인 JWT 검증은 활성화한 채로 유지하세요.

   ```bash
   npx supabase functions deploy analyze-card-bill
   ```

4. 프런트엔드는 기존 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`로 연결합니다. Node.js 20.9 이상에서 `npm run build` 후 기존 GitHub Pages 배포를 사용합니다.

### 사용 및 인식 범위

- 홈의 **카드값 → 캡처 등록 · 관리**에서 캡처를 선택하고 **캡처 분석**을 누릅니다. JPG/PNG/WebP, 원본 최대 10MB를 지원합니다.
- 브라우저에서 JPEG로 재인코딩한 이미지를 분석 서비스로 전송합니다. 원본 이미지/계좌번호를 머니북 DB나 Storage에 저장하지 않습니다. API 요청은 `store: false`입니다(분석 제공업체 자체의 데이터 보관 정책은 별도입니다).
- 청구 총액, 카드사, 실제 결제일, 금액 기준일, 일시불·할부를 추출합니다. 상단 조회 날짜를 결제일로 대체하지 않습니다. 명시된 연도가 없거나 여러 청구액이 모호하면 사용자 확인을 요구합니다.
- 누적 이용금액을 청구 총액으로 자동 선택하지 않습니다. 다른 카드사 UI도 같은 분석 경로를 사용하지만 인식 정확도는 실화면으로 확인해야 합니다.
- 카드사/결제 월/금액을 확인하고 저장합니다. 기존보다 오래된 기준일이면 갱신 전에 안내합니다.
- 카드사별 금액 아래의 **메모 추가/수정**에서 해당 결제 월의 메모를 500자까지 저장할 수 있습니다. 빈 메모를 저장하면 지워집니다. 캡처를 다시 등록할 때 새 메모를 입력하지 않으면 기존 메모가 유지됩니다.
- 데모 모드에서는 직접 입력·수정·합계를 브라우저에 저장하며 AI 호출은 하지 않습니다. 이미지 분석을 연결하지 않아도 데이터 테이블이 있으면 직접 입력은 가능합니다.
- 이 변경에는 **개별 결제 내역 캡처 → 거래 자동 입력** 기능은 포함하지 않습니다.

### 검증

```bash
npm run lint
npm run build
npx tsx --test scripts/test-card-bills.mts
npx deno check supabase/functions/analyze-card-bill/index.ts
```

테스트는 카드사 정규화, 월별 중복 갱신, 기존 데이터 보존, 모호한 총액, 날짜 검증, 인증 실패, 과대 이미지, 모델 거절/시간초과를 다룹니다. API 응답은 모의 응답이며, 실제 AI 인식과 운영 DB 연결은 위 설정 후 별도 확인해야 합니다.

구현 참고: [OpenAI 이미지 입력](https://developers.openai.com/api/docs/guides/images-vision), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses), [Supabase 함수 인증](https://supabase.com/docs/guides/functions/auth).
