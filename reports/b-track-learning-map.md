# 보안 학습 맵과 문서 연결

> 노말틱, 레드라쿤/OSCP, THM, HTB, PortSwigger, 포너블 노트를 포트폴리오 문서와 연결한 학습 지도

---

## 1. 작성 목적

이 포트폴리오가 단순히 여러 보고서를 모아둔 형태로 보이지 않도록, 각 문서가 어떤 학습 흐름에서 나왔는지 정리했다. 헌팅마스터 B트랙은 웹/모바일 취약점 분석, 보고서 작성, AI 활용 버그헌팅, CTF형 평가가 함께 들어가기 때문에 학습 축을 분리해서 보여주는 것이 중요하다고 판단했다.

이 문서는 “무엇을 많이 했다”보다 “어떤 수업과 실습이 어떤 결과물로 이어졌는가”를 설명하는 메타 문서다.

---

## 2. 전체 학습 축

| 학습 축 | 정리한 내용 | 포트폴리오 연결 |
| --- | --- | --- |
| 노말틱 / 버그헌팅 지원 준비 | B트랙 지원 방향, 웹/모바일 보고서 작성 기준 | README, SQLi, XSS, Mobile |
| 레드라쿤 / OSCP형 AD | HTB Forest, Search, AD 공격 경로 복습 | HTB Forest, HTB Search, Recon AD |
| THM 시스템 분석과 모의해킹 | 정찰, 초기 침투, 권한 상승, Windows 후속 분석 | THM Cod Caper, THM Linux, HTB Blue, THM ICE |
| PortSwigger / HTB Academy | XSS, Access Control, IDOR, Web Fuzzing | XSS 보고서, 웹 퍼징/XSS/IDOR 복습 |
| 포너블 / 시스템 해킹 | BOF, SUID, PATH, GDB/IDA 분석 | BOF01, BOF11, Pwn Checklist, Reversing Solver |
| 보안 제품 / 탐지 | Nessus, Snort, Suricata, YARA, Sigma | Nessus / IDS 실습 |
| AI/MCP 워크플로우 | HexStrike, MCP, Codex/Cursor, OSINT self-audit | AI/MCP 기반 버그헌팅 워크플로우 |

---

## 3. 핵심 학습과 연결

### 웹 취약점 분석

웹 영역은 SQL Injection, XSS, 로그인 로직, IDOR, 웹 퍼징 노트로 연결했다. 단순히 payload를 외우는 것이 아니라, 입력값이 어떤 HTTP 요청으로 들어가고 어떤 문맥에서 해석되는지를 추적하는 방식으로 정리했다.

대표 문서:

- SQL Injection 보고서
- XSS 보고서
- 인증/로그인 로직 5종 분석
- 웹 퍼징/XSS/IDOR 복습 노트
- Web Pentest Checklist

### 모바일 분석

모바일 영역은 Android APK를 jadx-gui로 정적 분석하고, Frida로 런타임 동작을 확인하는 흐름으로 정리했다. 공개 문서에는 실제 secret이나 민감 로그를 그대로 남기지 않고, 어떤 클래스와 메서드를 확인해야 하는지 중심으로 작성했다.

대표 문서:

- 모바일 앱 보안 분석 보고서

### CTF형 침투 흐름

CTF/실습형 침투는 정찰, 초기 침투, 계정 정보 확인, 권한 상승, 증거 정리까지 이어지는 흐름으로 묶었다.

대표 문서:

- THM The Cod Caper
- THM Linux 권한상승 복습
- HTB Blue
- THM ICE
- HTB Forest
- HTB Search
- HTB Spookifier

### 시스템 해킹과 리버싱

포너블과 시스템 해킹 노트는 BOF, ret2libc, SUID, PATH hijacking, GDB/IDA 분석 흐름으로 연결했다. 이 영역은 웹/모바일과 다른 분석 층위를 다루며, CTF 평가와 문제 해결력을 보여주는 보조 역량으로 배치했다.

대표 문서:

- BOF01
- BOF11
- Reversing Solver
- Pwn Checklist
- GDB / pwndbg
- IDA Shortcuts

---

## 4. 학습 노트를 보고서로 바꾼 기준

원본 학습 노트에는 명령어, 실수 기록, 플래그, 캡처, 임시 메모가 섞여 있었다. 공개 포트폴리오에서는 다음 기준으로 다시 정리했다.

| 원본 노트 내용 | 공개 포트폴리오 처리 |
| --- | --- |
| flag, 비밀번호, 해시, 토큰 | 삭제 또는 마스킹 |
| 긴 도구 출력 | 핵심 판단 근거만 요약 |
| 실수 기록 | 원인과 다음 방지 체크리스트로 재정리 |
| 캡처 | 민감 값이 보이면 가림 처리 후 사용 |
| 자동화 도구 결과 | 수동 검증 기준과 함께 설명 |
| 근거가 부족한 후보 | 완료 처리하지 않고 보류 |

HTB Cap, Meow, Expressway는 이름만으로 억지 작성하지 않고, 전용 풀이 노트나 캡처 근거가 충분할 때 추가하기로 했다. 대신 실제 근거가 있는 THM/HTB/PortSwigger 노트를 먼저 공개 문서로 정리했다.

---

## 5. 추천 검토 순서

포트폴리오를 보는 사람이 모든 문서를 처음부터 끝까지 읽기 어렵다고 보고, 다음 순서로 대표 문서를 배치했다.

| 순서 | 문서 | 보여주고 싶은 점 |
| --- | --- | --- |
| 1 | SQL Injection | 입력값과 DB 쿼리 문맥을 추적하는 방식 |
| 2 | XSS | HTML/DOM 실행 문맥과 저장/반사 차이 이해 |
| 3 | Mobile | Android 정적/동적 분석 경험 |
| 4 | THM The Cod Caper | SQLi에서 SSH, BOF까지 이어지는 체인 |
| 5 | HTB Search / Forest | AD 환경에서 계정과 권한 관계 분석 |
| 6 | BOF / Reversing Solver | CTF형 문제 해결력 |
| 7 | AI/MCP Workflow | AI를 자동 공격이 아니라 검증 보조로 쓰는 관점 |
| 8 | B트랙 학습 맵 | 여러 수업과 실습이 결과물로 연결된 구조 |

---

## 6. 현재 보완 지점

| 보완 지점 | 현재 상태 | 보완 방법 |
| --- | --- | --- |
| HTB Cap/Meow/Expressway | 전용 근거 부족 | 풀이 노트나 캡처 확보 후 작성 |
| 모바일 캡처 | 공개 가능한 캡처 제한 | secret/log 마스킹 후 이미지 추가 |
| 실제 버그바운티 제출 | 학습/준비 단계 | IDOR/정보노출 중심으로 안전한 첫 제출 목표 |
| AI/MCP 실행 증거 | 운영 기준 중심 | 허가 범위와 수동 검증 로그 보강 |
| 탐지 룰 실습 | 개념/룰 중심 | pcap 기반 alert 결과 추가 |

---

## 7. 정리

이 포트폴리오는 한 번에 만든 문서 묶음이 아니라, 여러 수업과 실습에서 쌓인 노트를 보고서 형식으로 다시 정리한 결과물이다. 지금까지는 웹/모바일 핵심 문서를 먼저 완성하고, 이후 AD, 시스템 해킹, 리버싱, 탐지, AI/MCP 흐름을 보조 역량으로 붙였다.

앞으로도 새 라이트업은 “실제로 풀었는지”, “근거를 공개해도 안전한지”, “분석 경험과 지원 직무에 연결되는지”를 기준으로 추가할 계획이다.
