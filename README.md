# 모아보자 · 우리 둘의 가계부

실제 지출과 두 사람의 정산을 기록하는 한국어 공동 가계부입니다. **GitHub Pages + 가계부 전용 Supabase 프로젝트**로 배포합니다. 여행 사이트 파일/DB/키는 변경하거나 재사용하지 않았습니다.

가계부 전용 Supabase 프로젝트 **moaboja**(서울)와 GitHub 저장소 **parkjunil7/moaboja**를 사용합니다. DB 마이그레이션과 두 계정 등록, 실제 로그인 세션의 공유·정산 API 검증을 완료했습니다. 배포 주소는 https://parkjunil7.github.io/moaboja/ 입니다. 로그인 아이디는 **member-1 / member-2**입니다. 공개 회원가입은 차단했습니다. 예시 데이터는 메모리에만 있고 새로고침하면 초기화됩니다.

## 1. 여행 프로젝트에서 확인한 구성

읽기 전용으로 `C:\Users\user\Documents\travel`을 조사했습니다.

| 항목 | 확인 근거 | 결과 |
|---|---|---|
| DB | 루트 `supabase-config.js`, `script.js`의 `createClient`, 여러 `supabase-*.sql` | Supabase PostgreSQL |
| 로그인 | `script.js`의 `signInWithPassword` 및 로그인 별칭 매핑, `supabase-auth-lockdown.sql` | Supabase Auth 이메일/비밀번호, 두 이메일을 SQL 정책으로 제한 |
| 호스팅 | `.git/config`의 origin `https://github.com/parkjunil7/parkjunil7.github.io.git`, 정적 HTML/JS 구조 | GitHub Pages용 사용자 사이트 저장소. GitHub 연결에서도 저장소와 기본 브랜치 `main` 확인 |
| 환경 변수 | 루트 및 하위 디렉터리 파일 검색 | `.env*` 없음. 브라우저 설정 객체는 `SUPABASE_CONFIG.url`, `SUPABASE_CONFIG.anonKey` |
| 패키지/배포 | `package.json`, `.github/workflows`, 호스팅 설정 파일 검색 | 패키지 파일·명시적 배포 워크플로 없음. GitHub Pages의 실제 선택 브랜치/폴더 설정은 로컬에서 확인 불가 |
| README | `local-travel/README.md` | **별도 로컬 백업판**이며 localStorage 사용. 본 사이트의 공유 DB로 오인하지 않음 |

호스팅은 기존 저장소 구성상 GitHub Pages로 식별했습니다. 원격 사이트의 현재 배포 성공 상태와 Pages 관리 설정은 확인하지 못했습니다. 여행 사이트 URL/공개 키는 가계부 연결 값으로 복사하지 않았고, 빌드 및 초대 도구는 여행 프로젝트 주소를 거부합니다.

## 2. 로컬 실행

Node.js **22.12 이상** 또는 24 LTS가 필요합니다.

Windows에서 Volta가 이전 Node.js 18을 선택하더라도, 실행 스크립트가 `Program Files\nodejs`에 설치된 최신 Node.js를 자동으로 사용합니다. 시스템 PATH나 다른 프로젝트의 설정은 바꾸지 않습니다. `crypto.hash is not a function` 오류가 났다면 수정된 프로젝트에서 `npm run dev`를 다시 실행하세요.

```powershell
cd 'C:\Users\user\Documents\ChatGPT\가계부'
npm ci
npm run dev
```

`http://127.0.0.1:5173/` 접속 → 아이디와 개인 비밀번호로 로그인합니다. 현재 로컬 `.env`에 가계부 DB 연결이 설정되어 있습니다. **예시 데이터로 둘러보기**도 사용할 수 있습니다.

실제 DB를 연결하려면 아래 설정을 마친 후:

```powershell
Copy-Item .env.example .env # 새 설치에서만 실행. 기존 .env를 덮어쓰지 마세요.
# .env를 편집하여 새 가계부 프로젝트 값 설정
npm run dev
```

환경 변수를 바꾸면 개발 서버를 다시 시작하세요. 배포 빌드를 확인하려면:

```powershell
npm run build
npm run preview
```

`http://127.0.0.1:4173/`에서 확인할 수 있습니다. 빌드 결과만 제공하는 보조 서버는 `node scripts/serve.mjs`입니다.

Windows 제한 환경을 위해 로컬 빌드는 기존 `dist`를 재귀 삭제하지 않습니다. 이전 해시의 자산 파일이 남아도 새 `index.html`이 최신 파일을 참조합니다. 실제 배포는 새 checkout에서 시작하는 Actions 결과물을 사용하세요.

## 3. 가계부 전용 Supabase 만들기

현재 프로젝트는 `gqttecguoftuwjanunry`이며 아래 생성·SQL 단계는 적용 완료입니다. 새 환경을 다시 구성할 때만 사용하세요.

1. Supabase에서 여행 프로젝트와 **별도 프로젝트**를 만듭니다. 예: `moaboja`. 여행 DB에 테이블을 추가하지 않습니다.
2. 새 프로젝트 SQL Editor에서 다음 파일을 **순서대로, 각각 한 번씩** 실행합니다.
   - `supabase/migrations/001_ledger.sql`
   - `supabase/migrations/002_snapshot.sql`
   - `supabase/migrations/003_category_updates.sql`
   - `supabase/migrations/004_exercise_items.sql`
3. Authentication 설정에서 **신규 사용자 공개 가입을 비활성화**합니다. 이메일/비밀번호 로그인은 사용합니다. 사이트에는 공개 회원가입 화면이 없습니다.
4. Authentication → URL Configuration의 Site URL을 가계부의 최종 배포 주소로 지정하고, Redirect URLs에 아래를 등록합니다. 저장소 경로와 끝의 `/`를 포함하세요.
   - `https://<GitHub사용자>.github.io/<가계부저장소>/`
   - `https://<GitHub사용자>.github.io/<가계부저장소>/?welcome=1`
   - 로컬 확인 시 `http://127.0.0.1:5173/` 및 `http://127.0.0.1:5173/?welcome=1`
5. 현재 두 아이디는 내부 인증용 `.invalid` 주소로 연결합니다. 이메일 발송이나 SMTP 설정은 필요하지 않습니다. 관리자가 비밀번호 설정 링크를 생성해 본인에게 전달합니다.
6. 새 프로젝트의 API URL과 publishable key(또는 legacy anon key)를 `.env`에 입력합니다.

| 변수 | 용도 | 브라우저 포함 여부 |
|---|---|---|
| `VITE_SUPABASE_URL` | 가계부 프로젝트 URL | 공개 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 가계부 publishable/anon 키 | 공개, RLS로 보호 |
| `SUPABASE_SERVICE_ROLE_KEY` | 로컬 초대 스크립트의 관리자 키. legacy service role 또는 새 secret key | **절대 포함 금지** |
| `APP_URL` | 초대 후 돌아올 가계부 주소. 끝에 `/` 권장 | 초대 스크립트 전용 |
| `TEST_USER_A_EMAIL`, `TEST_USER_A_PASSWORD` | 실제 통합 테스트 첫 계정 | 테스트 프로세스 전용 |
| `TEST_USER_B_EMAIL`, `TEST_USER_B_PASSWORD` | 실제 통합 테스트 두 번째 계정 | 테스트 프로세스 전용 |

`.env`는 Git에서 제외됩니다. `.env.example`에는 변수 이름과 빈 값만 있습니다. DB 비밀번호는 SQL Editor 방식에서 필요하지 않아 코드/파일에 저장하지 않습니다. 관리자 키와 비밀번호에 `VITE_` 접두사를 붙이지 마세요. 빌드에서 secret/service role 키가 공개 변수에 설정되면 중단합니다. 실제 사용자 비밀번호는 Supabase Auth가 관리합니다.

## 4. 본인과 여자친구 계정 초대

가계부 전용 `.env`에 관리자 키와 `APP_URL`을 설정한 뒤 실행합니다. 현재 두 계정은 이미 등록되어 있으며, 재실행하면 기존 계정의 비밀번호 설정 링크를 새로 만듭니다. 실제 이메일을 수집하지 않으며 여행 사이트 계정과도 별개입니다.

```powershell
npm run account-link -- member-1
npm run account-link -- member-2
```

`artifacts/private/member-1-비밀번호설정.html`과 `member-2-비밀번호설정.html`이 생성됩니다. 각자의 파일을 열어 **모아보자 비밀번호 설정** → **12자 이상의 개인 비밀번호**를 저장합니다. 이후 사이트에서 아이디/비밀번호로 로그인합니다. 멤버2님에게는 멤버2님 파일만 직접 전달하세요. 파일은 계정에 접근할 수 있는 일회용 링크를 포함하므로 공개 저장소나 공개 채팅에 올리지 않습니다. 링크가 만료되면 위 명령으로 재발급합니다. `members`는 1번과 2번만 허용하며 이미 채워진 자리를 스크립트가 덮어쓰지 않습니다.

계정 생성 후 멤버 등록만 실패했다면 같은 명령을 재실행해 복구할 수 있습니다. 이메일 없는 계정이므로 자동 이메일 복구는 지원하지 않습니다. 로그인 화면의 비밀번호 재설정은 관리자에게 링크를 요청하도록 안내합니다. 관리자 키는 로컬 `.env`에서만 사용하며 웹사이트나 GitHub에 올리지 않습니다.

## 5. 독립 GitHub Pages 배포

저장소: https://github.com/parkjunil7/moaboja · 사이트: https://parkjunil7.github.io/moaboja/

1. 이 프로젝트를 새 저장소의 `main` 브랜치에 올립니다. `.env`, `node_modules`, `dist`는 올리지 않습니다.
2. 새 저장소 Settings → Pages → Source를 **GitHub Actions**로 지정합니다.
3. Settings → Secrets and variables → Actions → **Variables**에 가계부 전용 공개 변수 두 개를 등록합니다.
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. `.github/workflows/deploy.yml`이 설치 → 테스트 → 독립 연결 설정 검사 → 빌드 → Pages 배포를 수행합니다. `main`에 push하거나 Actions의 수동 실행으로 시작합니다.
5. 완료된 `github-pages` 배포 URL을 열고 Supabase Site URL, Redirect URLs, `.env`의 `APP_URL`을 그 주소와 일치시킵니다.
6. 두 사람을 초대하고 서로 다른 기기/브라우저에서 로그인합니다.

**서비스 역할 키는 GitHub Pages에 등록하지 않습니다.** 호스팅은 정적 파일만 제공하고, 인증·멤버 검사·쓰기 검증은 Supabase 서버(PostgreSQL RPC/RLS)에서 실행합니다. HTML/JS는 누구나 받을 수 있지만 실제 가계부 데이터는 초대 멤버의 검증된 로그인 토큰이 있어야 조회할 수 있습니다. 새 저장소에 Pages를 사용할 수 있는지는 해당 GitHub 요금제/저장소 공개 범위에서 확인하세요.

## 6. 사용과 계산 규칙

- 대시보드: 총지출, 공동 지출, 이자, 고정 생활비, 각자의 결제액/부담액, 분류별 합계, 장보기·생활비/외식비 전월 비교.
- 지출: 한국 시간 기준 오늘 및 로그인한 결제자 기본값. 월·분류·결제자 필터. 원 단위 금액, 내역, 세부 항목, 메모. 두 멤버 모두 수정/삭제 가능.
- 공동 지출은 두 사람의 부담액이 모두 0원보다 큰 지출의 결제액 합계입니다. 한 사람이 전액 부담하면 월 총지출에는 포함하고 공동 지출 합계에서는 제외합니다.
- 반반은 홀수 금액일 때 **1번 멤버가 1원 더 부담**합니다. 직접 지정에서 두 사람 각각의 부담액을 입력합니다. 합계는 반드시 결제액과 같아야 합니다. '결제자 전액' 또는 직접 지정의 0원으로 한 사람만 부담할 수 있습니다.
- 한 건 금액은 1원~10억원입니다. 두 부담액은 0원 이상 정수입니다. 미래의 지출·송금은 등록하지 않습니다.
- 관리비/주차비 템플릿이 기본 제공됩니다. 납부 후 날짜와 실제 금액을 확인해 등록합니다. 지출일이 속한 월을 기준으로 같은 템플릿 중복을 DB 고유 제약으로 차단합니다.
- 정산 = 각자의 결제액 − 부담액. 예: 1번이 60,000원 결제, 각 30,000원 부담 → 2번이 1번에게 30,000원.
- 송금은 **선택한 정산 월**에만 반영합니다. 송금일이 다음 달이어도 해당 정산 월을 줄이며, 총지출에는 더하지 않습니다. 일부 송금도 가능하고 남은 금액을 초과할 수 없습니다.
- 이미 정산한 지출을 수정/삭제하면 반환할 금액이 생길 수 있습니다. 송금 기록 자체를 없애지 않고 반대 방향의 잔액으로 표시합니다. 잘못 기록한 송금은 정산 화면에서 삭제합니다.
- 설정에서 대분류와 세부 항목을 추가/수정하고 반복 템플릿을 추가/수정합니다. 기본 분류 이름이 바뀌어도 금융비용/고정비/생활비/외식비 집계 기준은 유지됩니다.
- 고정 생활비 기본 항목은 관리비·주차비입니다. 교통비에는 외부 주차료, 외식비에는 빙과(빙수), 운동·배움에는 헬스비·수영비·기타 수업료가 있습니다. 분류 목록에서 기타는 항상 맨 아래에 표시됩니다.
- `003`까지 적용한 기존 DB에는 `004_exercise_items.sql`을 적용하세요. 운동 강습비는 기존 기록을 보존한 채 새 입력 목록에서 숨깁니다.
- 기존 DB를 연결한 상태라면 `003_category_updates.sql`을 추가 적용하세요. 이전 전기·가스·수도/인터넷/정기 구독 항목은 새 입력·설정 목록에서 숨기고 기존 기록은 유지합니다. 해당 옛 기록을 수정할 때에는 기존 항목이 '(이전 항목)'으로 표시됩니다.
- 서버가 같은 가계부를 공유하며, 30초 간격 및 화면으로 돌아올 때 갱신합니다. 새로고침 버튼으로 즉시 갱신할 수 있습니다. 오프라인 저장은 지원하지 않습니다.

## 7. 서버 보호와 검증

- Supabase Auth의 검증된 JWT에서 `auth.uid()`를 얻고 실제 `members.user_id`와 비교합니다. 클라이언트가 보낸 사용자 ID나 이메일을 권한으로 신뢰하지 않습니다.
- 읽기 테이블 RLS와 모든 RPC에서 멤버를 검사합니다. 클라이언트의 테이블 직접 쓰기 권한은 회수했습니다. 관리자만 멤버를 초대할 수 있습니다.
- 지출·송금 쓰기는 공통 행 잠금으로 직렬화하여 두 기기에서 동시에 같은 잔액을 정산하는 것을 방지합니다. 지출 수정에는 버전 번호를 검사합니다.
- `get_ledger`는 단일 DB 스냅샷을 반환하여 조회 행 제한으로 합계가 잘리는 것을 방지합니다. 규모가 매우 커지면 월별 서버 집계·페이지 조회로 확장할 수 있습니다.

```powershell
npm test
npm run build
```

로컬 자동 테스트는 PGlite의 실제 PostgreSQL 엔진에 **배포할 SQL을 그대로 적용**합니다. Supabase Auth의 사용자 테이블/세션만 테스트용으로 대체합니다. 실제 Supabase 로그인/메일 통신을 시험한 것으로 간주하지 않습니다.

두 계정이 준비되면 `.env`에 `TEST_USER_*` 변수를 입력하고:

```powershell
npm run test:live
```

초기 설치 시에는 비밀번호 없이 관리자 발급 일회용 인증으로 `npm run test:live -- --admin-link`를 실행할 수 있습니다. 데이터 읽기·쓰기 검증은 관리자 권한이 아닌 각 사용자의 인증 세션으로 실행합니다. 이 방식은 비밀번호 입력 UI의 검증과는 구분됩니다. 두 아이디별 초기 비밀번호 저장과 비밀번호 로그인은 각자가 완료해야 합니다.

실제 두 계정으로 로그인하고 2000년 1월에 테스트 지출을 만들어 공유 조회, 50:50, 직접 부담, 송금 분리를 확인합니다. 기존 2000년 1월 데이터가 있으면 시작하지 않습니다. 테스트가 만든 UUID만 마지막에 삭제합니다. 테스트가 강제 중단되면 `[자동 검증] 종료 시 삭제` 내역과 해당 테스트 송금을 확인하세요.

검증 기록과 제한은 `docs/VERIFICATION.md`에 있습니다.

## 참고 문서

- [Supabase RLS와 auth.uid()](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase 사용자 초대와 관리자 키](https://supabase.com/docs/guides/auth/users)
- [GitHub Pages Actions 배포](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
