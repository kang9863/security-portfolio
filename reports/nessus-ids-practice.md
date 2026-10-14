# Nessus / IDS 실습 결과 정리

## 1. 개요

이 문서는 취약점 스캐너와 IDS 룰 기반 탐지를 함께 정리한 보조 역량 보고서다. 침투 테스트 관점에서는
Nmap이나 수동 분석으로 취약점을 확인하지만, 방어 관점에서는 Nessus 같은 스캐너로 취약 상태를 관리하고
Snort/Suricata 같은 IDS로 의심 트래픽을 탐지해야 한다.

## 2. 실습 목표

| 항목 | 목표 |
| --- | --- |
| Nessus | 대상 서비스의 취약점, CVE, 위험도, 해결 방안 확인 |
| Snort | 패킷 조건 기반 alert rule 작성 |
| Suricata | Snort 유사 룰과 eve.json 로그 확인 |
| 보고서화 | 스캔 결과를 단순 목록이 아니라 조치 우선순위로 정리 |

## 3. Nessus 실습 흐름

```text
스캔 대상 범위 확인
  -> Basic Network Scan 생성
  -> 포트/서비스 식별
  -> 취약점 플러그인 결과 확인
  -> Critical/High 우선 정리
  -> false positive 여부 검토
  -> 조치 방안과 재검증 계획 작성
```

Nessus 결과는 그대로 붙여 넣기보다 다음 기준으로 다시 정리한다.

| 기준 | 확인 내용 |
| --- | --- |
| Severity | Critical / High / Medium / Low |
| Evidence | 어떤 포트와 서비스에서 탐지됐는지 |
| Exploitability | 인증 없이 악용 가능한지, 내부 접근이 필요한지 |
| Remediation | 패치, 설정 변경, 포트 제한, 버전 업그레이드 |
| Verification | 조치 후 재스캔 또는 수동 검증 방법 |

## 4. Snort 룰 작성

Snort 룰은 헤더와 옵션으로 구성된다.

```text
alert tcp any any -> any 80 (msg:"Possible test payload"; content:"/etc/passwd"; nocase; sid:1000001; rev:1;)
```

구성 요소:

| 요소 | 의미 |
| --- | --- |
| `alert` | 탐지 시 경고 발생 |
| `tcp` | 프로토콜 |
| `any any -> any 80` | 출발지/목적지 IP와 포트 |
| `msg` | 경고 메시지 |
| `content` | 탐지할 문자열 |
| `sid` | 룰 고유 ID |
| `rev` | 룰 버전 |

웹 공격 테스트에서 자주 확인할 룰 예시는 다음과 같다.

```text
alert tcp any any -> any 80 (msg:"SQLi keyword UNION SELECT"; content:"union"; nocase; content:"select"; nocase; distance:0; sid:1000002; rev:1;)
alert tcp any any -> any 80 (msg:"XSS script tag attempt"; content:"<script"; nocase; sid:1000003; rev:1;)
alert tcp any any -> any 80 (msg:"Path traversal attempt"; content:"../"; sid:1000004; rev:1;)
```

## 5. Suricata 확인 흐름

Suricata는 Snort 스타일 룰을 사용할 수 있고, JSON 기반 로그인 `eve.json`으로 탐지 결과를 확인하기 좋다.

```bash
suricata -r sample.pcap -S local.rules -l logs/
jq 'select(.event_type=="alert")' logs/eve.json
```

확인 항목:

- alert signature
- source / destination IP
- destination port
- HTTP URI 또는 payload 일부
- 탐지 시간
- rule sid/rev

## 6. 스캐너와 IDS의 차이

| 구분 | Nessus | Snort / Suricata |
| --- | --- | --- |
| 목적 | 취약 상태 점검 | 트래픽 기반 탐지 |
| 시점 | 주기적 스캔 | 실시간 또는 pcap 분석 |
| 결과 | CVE, 위험도, 조치 방안 | alert, signature, packet evidence |
| 한계 | false positive, 인증 스캔 품질 의존 | 우회 가능성, 룰 튜닝 필요 |

Nessus가 “어떤 시스템이 취약한가”를 보여준다면, IDS는 “의심스러운 시도가 실제로 들어왔는가”를 보여준다.
침투 테스트 보고서에서는 두 결과를 연결하면 취약점의 위험도와 탐지 가능성을 더 설득력 있게 설명할 수 있다.

## 7. 보고서 작성 기준

취약점 스캐너 결과를 포트폴리오에 넣을 때는 아래처럼 정리한다.

```text
취약점명:
영향 서비스:
위험도:
탐지 근거:
수동 검증:
대응 방안:
재검증 방법:
```

IDS 룰은 아래 기준으로 정리한다.

```text
탐지 목적:
룰:
테스트 payload:
예상 alert:
오탐 가능성:
튜닝 방향:
```

## 8. 학습한 점

- Nessus 결과는 “목록”이 아니라 우선순위와 조치 계획으로 바꿔야 보고서 가치가 생긴다.
- Snort/Suricata 룰은 너무 넓게 쓰면 오탐이 많고, 너무 좁게 쓰면 우회가 쉽다.
- 공격 실습을 한 뒤 탐지 룰까지 작성하면 취약점의 공격/방어 양쪽 흐름을 함께 설명할 수 있다.
- B트랙 포트폴리오에서는 메인 역량은 Web/Mobile이지만, 탐지 관점은 보고서 완성도를 높이는 보조 강점이 된다.
