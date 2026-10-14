# 웹 퍼징/XSS/IDOR 복습 노트

> HTB Academy, PortSwigger Web Security Academy, 개인 버그바운티 노트에서 반복해서 틀렸던 부분을 정리한 웹 취약점 복습 문서입니다. 단순 명령어 모음이 아니라, 결과를 어떻게 검증하고 보고서 근거로 바꾸는지에 초점을 맞췄습니다.

## 1. 작성 목적

웹 취약점 분석에서 가장 많이 막혔던 부분은 “도구가 결과를 냈다”와 “취약점이 재현됐다”를 구분하는 일이었습니다. 그래서 퍼징, XSS, IDOR 학습 노트를 아래 기준으로 다시 정리했습니다.

- 퍼징 결과는 후보이고, `curl`/브라우저/Burp로 재현해야 확정
- Reflected XSS는 요청에 페이로드가 포함되어야 매번 재현됨
- vHost 문제는 `/etc/hosts`와 URL 포트 처리를 구분해야 함
- IDOR는 반드시 2개 이상의 계정으로 권한 검증해야 함
- PoC는 취약점 존재만 증명하고 실제 피해를 만들지 않아야 함

## 2. 웹 퍼징 기본 루틴

제가 정리한 웹 퍼징의 기본 문장은 다음입니다.

```text
퍼징 결과 = 후보
curl 응답 대조 = 경로·동작 확인 근거; 취약점 확정에는 권한·영향 검증이 추가로 필요
```

고정 루틴:

1. 브라우저나 `curl`로 기본 응답 확인
2. 상태 코드, 응답 길이, 단어 수, 라인 수, 헤더 확인
3. 입력 위치 분리: path, query, body, header, extension, vHost
4. 노이즈 제거 기준 기록
5. 후보 경로를 `curl -i` 또는 Burp Repeater로 재현
6. 보고서에는 원본 요청/응답과 판단 근거를 남김

## 3. ffuf/gobuster/feroxbuster 사용 기준

### 디렉터리/파일 퍼징

```bash
ffuf -w /usr/share/seclists/Discovery/Web-Content/common.txt \
  -u http://<TARGET>/FUZZ \
  -e .php,.html,.txt,.bak,.js \
  -mc 200,204,301,302,307,401,403
```

```bash
gobuster dir -u http://<TARGET>/ \
  -w /usr/share/seclists/Discovery/Web-Content/common.txt \
  -s 200,301,302,307
```

```bash
feroxbuster -u http://<TARGET>/ \
  -w /usr/share/seclists/Discovery/Web-Content/common.txt \
  -x php,html,txt,bak,js
```

### 워드리스트 선택

| 워드리스트 | 쓰는 상황 |
|---|---|
| `common.txt` | 첫 탐색, 빠른 확인 |
| `directory-list-2.3-medium.txt` | 디렉터리 중심으로 넓게 확인 |
| `DirBuster-2007_directory-list-2.3-medium.txt` | 실습/CTF에서 안정적으로 재확인 |
| `raft-large-directories.txt` / `big.txt` | 마지막 정밀 탐색 |

처음에는 작은 리스트로 방향을 잡고, 안 나오면 더 큰 리스트로 확장하는 편이 효율적이었습니다.

## 4. 노이즈 제거 패턴

퍼징에서 중요한 것은 많이 찍는 것이 아니라 의미 없는 응답을 빨리 제거하는 것입니다.

```bash
# 상태 코드 기준
ffuf -u http://<TARGET>/FUZZ -w wordlist.txt -mc 200,204,301,302,307,401,403

# 동일한 에러 페이지 크기 제거
ffuf -u http://<TARGET>/FUZZ -w wordlist.txt -fs 4242

# 단어 수/라인 수 기준
ffuf -u http://<TARGET>/FUZZ -w wordlist.txt -fw 100
ffuf -u http://<TARGET>/FUZZ -w wordlist.txt -fl 50
```

복습하면서 정리한 실수:

- 404가 모두 200으로 위장되면 상태 코드 필터만으로는 부족함
- 이때는 응답 크기, 단어 수, 라인 수를 기준으로 필터링
- 퍼징 결과를 바로 정답으로 제출하지 말고 `curl -i`로 재현
- “Wrong path” 같은 문구는 종료 신호가 아니라 기준 경로 수정 신호일 수 있음

## 5. vHost 퍼징에서 틀렸던 부분

vHost 문제에서 가장 크게 헷갈렸던 부분은 `/etc/hosts`에 포트를 넣은 실수였습니다.

```text
올바른 hosts 형식:
<IP> hidden.example.htb

잘못된 형식:
<IP>:<PORT> hidden.example.htb
```

포트는 hosts 파일이 아니라 URL에 붙여야 합니다.

```bash
gobuster vhost -u http://example.htb:<PORT> \
  -w /usr/share/seclists/Discovery/DNS/fierce-hostlist.txt \
  -t 100 --append-domain
```

2단 vHost도 체크해야 합니다.

```text
root vHost
-> directory fuzz
-> vHost fuzz
-> 새 vHost를 hosts에 추가
-> 새 vHost 대상으로 다시 fuzz
```

이 루틴은 HTB Academy Web Fuzzing 복습에서 가장 많이 남은 패턴입니다.

## 6. XSS 복습 포인트

### Reflected XSS

Reflected XSS는 요청에 페이로드가 들어 있을 때만 실행됩니다. 새로고침이나 다른 URL 접근으로 사라지는 것을 취약점이 막힌 것으로 착각하지 않도록, 재현 URL을 정확히 저장해야 합니다.

실수:

- `document.cookie`를 `document.coookie`처럼 오타낸 경우
- DevTools Console에서 먼저 테스트하지 않은 경우
- 최초 재현 URL과 보고서 재현 URL이 달라진 경우

### Stored XSS / Session Hijacking 실습

쿠키 탈취 실습에서는 `nc`로 연결만 확인하는 것과 실제 저장 서버를 여는 것을 구분했습니다.

```text
nc = 연결 확인용
PHP 서버 = 실제 요청 처리와 로그 저장
```

그리고 `cookies.txt` 같은 저장 파일은 미리 만들어두어야 PHP에서 쓰기 실패가 나지 않습니다.

### 버그바운티 PoC 주의

| 행위 | 공개/실전 기준 |
|---|---|
| 무해한 DOM 변경 | 본인 계정/실습 환경에서만 PoC 가능 |
| 실제 페이지 변조 유지 | 금지 |
| 가짜 로그인 폼 삽입 | 본인 통제 환경에서만 설명용 |
| 실제 사용자 대상 자격증명 수집 | 금지 |
| 쿠키/세션 값 공개 | 금지 |

## 7. IDOR 테스트 기준

IDOR는 서버가 사용자가 요청한 리소스에 대한 소유권을 확인하지 않을 때 발생합니다.

테스트 절차:

1. 계정 A로 리소스 생성 또는 조회
2. 리소스 ID 확보
3. 계정 B로 같은 ID 요청
4. 응답이 동일하거나 민감 정보가 보이면 권한 검증 누락 의심
5. Burp Comparer로 계정별 응답 차이 비교

확인 포인트:

- URL path의 숫자 ID
- `?user_id=`, `?doc_id=`, `?file=` 같은 파라미터
- API body에 숨은 ID
- Base64로 감싼 object reference
- 예측 가능한 GUID/UUID

IDOR는 반드시 2개 이상의 계정으로 검증해야 하고, 개인정보나 주문 내역처럼 민감 정보가 포함되면 영향도가 커질 수 있습니다.

## 8. 보고서로 바꾸는 기준

학습 노트를 보고서로 바꿀 때는 다음 순서가 가장 자연스럽다고 정리했습니다.

```text
무엇을 입력했는가
-> 어떤 응답 차이가 있었는가
-> 왜 취약점 후보라고 봤는가
-> 다른 계정/요청에서도 재현되는가
-> 영향도는 어디까지인가
-> 어떤 대응이 필요한가
```

도구 출력은 그대로 붙이지 않고, 후보와 확정 근거를 분리해서 설명해야 읽는 사람이 흐름을 따라올 수 있습니다.

## 9. 재현 근거 품질 기준

웹 보고서에서 퀄리티를 올리려면 단순히 페이로드를 넣은 화면보다, 정상 요청과 취약 요청을 비교하는 근거가 필요합니다.

| 취약점 유형 | 좋은 근거 |
| --- | --- |
| 디렉터리 노출 | 퍼징 결과 + `curl -i` 응답 + 해당 경로의 의미 |
| vHost 발견 | Host 헤더 요청 전후 비교 + `/etc/hosts` 설정 기준 |
| Reflected XSS | 취약 URL, 실행 문맥, 브라우저 렌더링 결과 |
| Stored XSS | 저장 요청, 재방문 시 실행 위치, 영향 범위 |
| IDOR | 계정 A/B 요청 비교, 응답 차이, 권한 검증 누락 위치 |
| 인증 우회 | 정상 로그인 실패 요청과 우회 성공 요청 비교 |

특히 IDOR는 “다른 번호를 넣었더니 보였다”로 끝내면 부족합니다. 계정 A가 만든 리소스를 계정 B가 접근할 수 있다는 구조를 보여줘야 하고, 응답에 민감 정보가 있다면 공개 문서에서는 값을 마스킹해야 합니다.

## 10. Burp로 확인할 때의 기준

Burp Repeater를 사용할 때는 다음 순서가 좋았습니다.

```text
원본 요청 저장
-> 변조할 위치 하나만 바꿈
-> 응답 코드/길이/본문 비교
-> 쿠키나 권한 값이 바뀌었는지 확인
-> 계정 전환 후 같은 요청 반복
-> 결과를 표로 정리
```

비교할 항목:

- 요청 method와 endpoint
- cookie/session 값
- user id, object id, file id
- 응답 status code
- 응답 길이
- 민감 필드 존재 여부
- 서버 에러 또는 redirect 여부

이렇게 정리하면 “Burp를 썼다”가 아니라, 요청을 통제해서 취약점 여부를 검증했다는 점이 더 잘 드러납니다.

## 11. 오답 방지 체크리스트

- hosts 파일에는 포트를 넣지 않는다.
- 퍼징 결과는 반드시 `curl -i` 또는 Burp Repeater로 다시 확인한다.
- Reflected XSS는 재현 URL을 그대로 저장한다.
- JS 페이로드는 DevTools Console에서 먼저 문법 오류를 확인한다.
- Stored XSS는 저장 위치와 실행 위치를 분리해서 적는다.
- IDOR는 최소 2개 계정으로 확인한다.
- 실제 쿠키, 토큰, 개인정보는 보고서에 그대로 넣지 않는다.
- 자동화 도구 결과와 수동 검증 결과를 구분해서 작성한다.

## 12. 정리

웹 퍼징과 XSS, IDOR에서 반복해서 느낀 점은 자동화보다 검증 루틴이 중요하다는 것입니다. `ffuf`, `gobuster`, `Burp`, `curl`은 후보를 찾는 데 도움을 주지만, 취약점으로 확정하는 순간에는 계정 전환, 요청 재현, 응답 비교, 영향도 판단이 필요합니다.

앞으로 버그바운티 보고서를 작성할 때도 “도구가 찾았다”가 아니라 “내가 어떤 근거로 재현했고 왜 영향이 있는지 설명했다”는 형태로 정리할 계획입니다.
