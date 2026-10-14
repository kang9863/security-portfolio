# 인증/로그인 로직 분석 보고서 - 5가지 구현 패턴

---

## 1. 개요

로그인 기능은 단순히 아이디와 비밀번호를 비교하는 기능처럼 보이지만, 실제로는 식별,
인증, 세션 발급, 토큰 검증, 비밀번호 저장 방식이 모두 연결된 핵심 보안 경계입니다.

이 보고서는 실습용 SQL 기반 로그인 로직을 5가지 패턴으로 나누어 분석합니다. 각 패턴에서
입력값이 어떤 쿼리와 비교 로직으로 전달되는지, 어떤 취약점이 발생할 수 있는지, 안전한
구현을 위해 무엇을 점검해야 하는지 정리했습니다.

---

## 2. 분석 목적

- 식별(Authentication identifier)과 인증(Authentication proof)의 차이를 코드 흐름으로 이해
- 로그인 로직별 SQL Injection, 계정 열거, 비밀번호 저장 위험 분석
- Hash, Salt, 세션, JWT가 각각 어떤 문제를 해결하는지 정리
- 버그헌팅 관점에서 로그인/회원 기능 점검 루틴 작성

---

## 3. 기본 개념

| 구분 | 의미 | 예시 |
|------|------|------|
| 식별 | 사용자가 누구인지 찾는 단계 | `id`, `email`, `username` |
| 인증 | 그 사용자가 맞는지 증명하는 단계 | `password`, OTP, WebAuthn |
| 인가 | 인증된 사용자가 무엇을 할 수 있는지 확인 | `role`, `permission`, `tenant_id` |
| 세션 | 서버가 로그인 상태를 기억하는 방식 | `PHPSESSID`, `JSESSIONID` |
| 토큰 | 클라이언트가 상태 정보를 들고 다니는 방식 | JWT access token |

HTTP는 기본적으로 stateless이기 때문에 로그인 성공 이후에도 서버와 클라이언트는
세션 ID 또는 토큰을 이용해 로그인 상태를 이어갑니다. 따라서 로그인 보안은 비밀번호 비교
하나로 끝나지 않고, 세션 발급/만료/무효화까지 함께 확인해야 합니다.

---

## 4. 로그인 로직 5종

### 4.1 식별 + 인증 동시 처리

```sql
SELECT * FROM member
WHERE id = '<input_id>' AND pass = '<input_password>';
```

특징:

```text
id와 password가 하나의 SQL WHERE 조건에 함께 들어감
  -> 쿼리 문자열 조합 방식이면 SQL Injection에 취약
  -> 로그인 우회 payload가 성공할 가능성 높음
```

점검 포인트:

- 작은따옴표 입력 시 SQL 에러가 발생하는가?
- 실패/성공 응답 차이가 명확한가?
- `id`와 `password` 중 어느 파라미터가 SQL 문맥에 들어가는가?
- Prepared Statement를 사용하고 있는가?

취약 예시:

```php
$sql = "SELECT * FROM member WHERE id='$id' AND pass='$pass'";
```

안전한 예시:

```php
$stmt = $pdo->prepare("SELECT id, password_hash FROM member WHERE id = ?");
$stmt->execute([$id]);
```

---

### 4.2 식별 + 인증 분리 처리

```text
1. id로 사용자 row 조회
2. DB에서 저장된 password 값 확인
3. 입력한 password와 애플리케이션 코드에서 비교
```

예시:

```php
$stmt = $pdo->prepare("SELECT id, password_hash FROM member WHERE id = ?");
$stmt->execute([$id]);
$user = $stmt->fetch();

if ($user && password_verify($inputPassword, $user['password_hash'])) {
    // login success
}
```

장점:

- SQL 조건에 비밀번호가 직접 들어가지 않음
- 인증 비교를 애플리케이션 로직에서 명확히 분리 가능
- 실패 로그와 계정 잠금 정책을 적용하기 쉬움

주의점:

- 아이디가 존재할 때와 존재하지 않을 때 응답이 다르면 계정 열거가 가능
- 조회 쿼리 자체는 여전히 Prepared Statement가 필요
- 비밀번호 비교는 timing-safe 방식 또는 검증 함수 사용이 안전

---

### 4.3 식별 + 인증 동시 처리 with Hash

```sql
SELECT * FROM member
WHERE id = '<input_id>' AND pass_hash = SHA2('<input_password>', 256);
```

이 방식은 평문 비밀번호 저장보다 낫지만, SQL 문자열 조합으로 구현하면 여전히 위험합니다.
또한 단순 해시는 같은 비밀번호가 항상 같은 해시로 저장되기 때문에 유출 시 사전 공격에 약합니다.

위험 요소:

```text
단순 SHA-256
  -> 빠른 해시라 대량 크랙에 취약

Salt 없음
  -> 같은 비밀번호는 같은 해시

SQL에서 문자열 조합
  -> SQL Injection 가능성 유지
```

권장 방향:

- `SHA2(password)` 직접 구현보다 `password_hash()` 또는 bcrypt/Argon2 사용
- 사용자별 salt가 포함된 password hashing 함수 사용
- 해시 비교는 `password_verify()`로 수행

---

### 4.4 식별 + 인증 분리 처리 with Hash

```text
1. id로 사용자 조회
2. 저장된 password_hash 가져오기
3. 입력 비밀번호를 검증 함수로 비교
```

권장 구현:

```php
$stmt = $pdo->prepare("SELECT id, password_hash FROM member WHERE id = ?");
$stmt->execute([$id]);
$user = $stmt->fetch();

$dummyHash = '$2y$10$exampleexampleexampleexampleexampleexampleexampl';
$hashToVerify = $user ? $user['password_hash'] : $dummyHash;

if (password_verify($inputPassword, $hashToVerify) && $user) {
    session_regenerate_id(true);
    $_SESSION['user_id'] = $user['id'];
}
```

분석 포인트:

- 존재하지 않는 계정에도 더미 해시 검증을 수행하면 응답 시간 차이를 줄일 수 있음
- 로그인 성공 후 `session_regenerate_id(true)`로 세션 고정 공격을 줄일 수 있음
- 실패 횟수, IP, 계정 기준 rate limit을 별도로 적용해야 함

---

### 4.5 식별 + 인증 동시 처리 with Hash + Salt/개행

실습에서 자주 비교하는 패턴은 비밀번호에 salt 또는 개행 문자를 붙인 뒤 해시하는 방식입니다.

```php
$hash = hash('sha256', $password . $salt . "\n");
```

학습 목적:

```text
입력 원본
  -> 문자열 결합
  -> 개행/공백 포함 여부
  -> 해시 결과 변화
```

주의점:

- 개행 문자는 눈에 보이지 않아 디버깅이 어렵고, 클라이언트/서버 처리 차이를 만들 수 있음
- 직접 salt 조합을 설계하면 저장 형식, 길이, 알고리즘 교체가 어려움
- 실무에서는 직접 해시 조합보다 검증된 password hashing API를 사용하는 것이 안전

권장 방식:

```php
$hash = password_hash($password, PASSWORD_ARGON2ID);
password_verify($inputPassword, $hash);
```

---

## 5. 세션 점검

로그인 성공 이후에는 세션 처리가 안전한지 확인해야 합니다.

점검 항목:

```text
로그인 전후 세션 ID가 바뀌는가?
로그아웃 후 기존 세션 ID가 무효화되는가?
세션 쿠키에 HttpOnly, Secure, SameSite가 설정되어 있는가?
세션 ID가 충분히 랜덤한가?
다른 브라우저/기기에서 세션 재사용이 가능한가?
```

쿠키 예시:

```http
Set-Cookie: session=...; HttpOnly; Secure; SameSite=Lax
```

취약 시나리오:

```text
공격자가 미리 발급받은 세션 ID를 피해자에게 사용하게 함
  -> 피해자가 로그인
  -> 로그인 후에도 세션 ID가 유지됨
  -> 공격자가 같은 세션 ID로 로그인 상태 재사용
```

대응:

- 로그인 성공 시 세션 ID 재발급
- 로그아웃 시 서버 세션 삭제
- 민감 기능 접근 시 재인증 요구

---

## 6. JWT 점검

JWT는 `header.payload.signature` 구조입니다. 앞의 두 구간은 Base64URL 인코딩이므로
누구나 디코딩할 수 있고, 보안의 핵심은 서명 검증입니다.

점검 항목:

```text
alg 값을 none으로 바꿨을 때 통과하는가?
서명 검증을 실제로 수행하는가?
role, user_id, is_admin 같은 클레임을 클라이언트 값만 믿는가?
토큰 만료 exp가 있는가?
로그아웃/비밀번호 변경 후 토큰이 계속 유효한가?
JWT를 localStorage에 저장해 XSS에 노출시키는가?
```

취약 예시:

```text
payload의 "role": "user"를 "admin"으로 변경
  -> 서버가 서명을 검증하지 않음
  -> 관리자 API 접근 성공
```

대응:

- 허용 알고리즘을 서버에서 고정
- 서명 검증 실패 시 즉시 거부
- 권한은 토큰 클레임만 믿지 말고 서버 DB와 재검증
- 짧은 access token 수명과 refresh token 회전 적용

---

## 7. 버그헌팅 점검 루틴

```text
1. 로그인 요청 구조 확인
   -> method, endpoint, content-type, parameter

2. 식별/인증 처리 방식 추정
   -> id 존재 여부 응답 차이
   -> password 오류 메시지 차이
   -> SQL 에러/시간 차이

3. 인증 우회 가능성 확인
   -> SQLi, NoSQLi, type confusion, JSON 구조 변경

4. 계정 보호 확인
   -> rate limit, lockout, MFA, password reset token

5. 세션/토큰 확인
   -> 세션 재발급, 로그아웃 무효화, 쿠키 플래그, JWT 검증

6. 권한 경계 확인
   -> 로그인 후 user_id, role, tenant_id 변조
```

---

## 8. 영향도

| 취약점 | 영향 |
|--------|------|
| 로그인 SQL Injection | 인증 우회, 사용자 DB 유출 |
| 계정 열거 | 유효 계정 목록 수집, Password Spray 위험 증가 |
| 취약한 비밀번호 해시 | DB 유출 시 대량 계정 탈취 |
| 세션 고정/재사용 | 로그인 상태 탈취 |
| JWT 서명 검증 실패 | 권한 상승, 관리자 기능 접근 |
| 로그아웃 미무효화 | 토큰/세션 탈취 후 장기간 악용 |

---

## 9. 대응 방안

- 모든 로그인 쿼리에 Prepared Statement 적용
- 비밀번호는 bcrypt/Argon2 같은 password hashing API로 저장
- 존재하는 계정과 존재하지 않는 계정의 오류 메시지/응답 시간을 최대한 동일하게 처리
- 로그인 실패 횟수 제한, IP/계정 기반 rate limit, MFA 적용
- 로그인 성공 시 세션 ID 재발급, 로그아웃 시 세션 무효화
- 쿠키에 `HttpOnly`, `Secure`, `SameSite` 설정
- JWT는 서버에서 알고리즘을 고정하고 서명/만료를 반드시 검증
- 권한 판단은 클라이언트의 `role`, `is_admin`, `user_id` 값을 신뢰하지 않음

---

## 10. 학습한 점

- 인증은 비밀번호 비교이고, 인가는 로그인 이후 권한 검증이다. 둘을 분리해서 봐야 취약점이 보인다.
- 식별과 인증을 한 SQL 쿼리에 묶으면 SQL Injection이 곧 인증 우회로 이어질 수 있다.
- Hash는 평문 저장 문제를 줄이지만, 빠른 해시와 salt 없는 저장은 DB 유출 상황에서 약하다.
- 세션은 서버가 상태를 기억하는 방식이고, JWT는 클라이언트가 검증 가능한 상태를 들고 다니는 방식이다.
- 로그인 보고서는 payload보다 요청 흐름, 비교 위치, 세션 발급, 권한 검증 위치를 설명해야 설득력이 생긴다.
