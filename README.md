# 강문식 보안 포트폴리오

배포 URL: https://kang9863.github.io/security-portfolio/

여러 회사의 모의해킹·취약점 분석 직무 지원에 사용할 수 있는 보안 학습 포트폴리오입니다. 웹 취약점 보고서와 모바일 분석을 중심에 두고, AD, 시스템 해킹, 리버싱, 탐지, AI/MCP 워크플로우를 보조 역량으로 정리했습니다.

이 포트폴리오는 실제 서비스 공격 자료가 아니라, 허가된 CTF/실습 환경과 개인 학습 노트를 공개 가능한 보고서 형식으로 다시 정리한 결과물입니다. 비밀번호, 해시, 토큰, flag, 실제 서비스 식별자는 공개하지 않습니다.

---

## 구성

| 경로 | 설명 |
| --- | --- |
| `index.html` | 포트폴리오 메인 페이지 |
| `viewer.html` | Markdown 문서 뷰어 |
| `catalog.json` | 전체 문서 제목·분류·검색 메타데이터 |
| `content/` | 본문 HTML 문서와 목차 뷰어 입력 |
| `reports/` | 보고서와 라이트업 |
| `cheatsheets/` | 실습 중 사용한 명령어와 체크리스트 |
| `assets/` | 보고서 캡처 이미지 |
| `SECURITY.md` | 실습 범위와 윤리 기준 |

---

## 대표 검토 순서

| 순서 | 문서 | 보여주는 역량 |
| --- | --- | --- |
| 1 | [SQL Injection 보고서](reports/sql-injection-report-sample.md) | 입력값, SQL 문맥, 수동 검증, 대응 방안 |
| 2 | [XSS 보고서](reports/xss-report-sample.md) | Reflected/Stored/DOM XSS 문맥 분석 |
| 3 | [모바일 앱 보안 분석](reports/mobile-hacking-writeup.md) | jadx-gui, Frida, 루팅 탐지 우회, secret 분석 |
| 4 | [THM The Cod Caper](reports/thm-cod-caper-writeup.md) | SQLi, SSH key, BOF로 이어지는 체인형 풀이 |
| 5 | [HTB Search](reports/htb-search-writeup.md) | Kerberoast, Password Spray, PFX/PSWA, gMSA |
| 6 | [HTB Forest](reports/htb-forest-writeup.md) | Anonymous LDAP, AS-REP, WriteDACL, DCSync |
| 7 | [리버싱 Solver 정리](reports/reversing-solver-writeup.md) | IDA 분석과 Python solver 재구현 |
| 8 | [B트랙 학습 맵](reports/b-track-learning-map.md) | 노말틱, 레드라쿤, THM, HTB, PortSwigger 학습 연결 |

---

## 보고서 목록

| 보고서 | 핵심 내용 |
| --- | --- |
| [인증/로그인 로직 분석](reports/auth-login-logic-analysis.md) | 식별/인증, Hash, Salt, 세션, JWT |
| [SQL Injection](reports/sql-injection-report-sample.md) | Login Bypass, Error-Based SQLi, sqlmap 보조 검증 |
| [CVE-2021-41773](reports/cve-2021-41773-path-traversal.md) | Apache Path Traversal, URL path 처리 문제 |
| [Recon and AD Attack Path](reports/recon-ad-attack-path.md) | Nmap, SMB, LDAP, Kerberos, BloodHound |
| [BOF02 ret2libc](reports/system-hacking-writeup.md) | Stack BOF, libc leak, ret2libc |
| [BOF01](reports/bof01-writeup.md) | offset 계산, RET overwrite, ret2win 기본 |
| [BOF11](reports/bof11-ida-gdb-writeup.md) | IDA 정적 분석, GDB offset 검증 |
| [THM The Cod Caper](reports/thm-cod-caper-writeup.md) | SQLi, SSH key, BOF, John |
| [XSS](reports/xss-report-sample.md) | Reflected, Stored, DOM XSS |
| [THM Blue](reports/htb-blue-writeup.md) | MS17-010, EternalBlue, SYSTEM |
| [THM ICE](reports/thm-ice-windows-privesc.md) | UAC Bypass, migrate, kiwi, credential dump |
| [HTB Forest](reports/htb-forest-writeup.md) | AS-REP Roasting, WriteDACL, DCSync |
| [DreamHack XSS](reports/dreamhack-xss-writeup.md) | xss-1/2, 필터 우회, CSRF, admin bot |
| [HTB Spookifier](reports/htb-spookifier-ssti.md) | Flask/Mako SSTI, template expression execution |
| [HTB Search](reports/htb-search-writeup.md) | Kerberoast, Password Spray, PFX/PSWA, gMSA |
| [DreamHack Dream Casino](reports/dreamhack-dream-casino.md) | MT19937 난수 예측 |
| [Reversing Solver](reports/reversing-solver-writeup.md) | IDA, XOR, S-box, Python solver |
| [Mobile App Security](reports/mobile-hacking-writeup.md) | jadx-gui, Frida, UnCrackable, AndroGoat |
| [Nessus / IDS](reports/nessus-ids-practice.md) | Nessus, Snort, Suricata, YARA, Sigma |
| [Windows LPE](reports/windows-lpe-topic1.md) | Access Token, Integrity Level, UAC, 서비스 권한 |
| [THM Linux 권한 상승 복습](reports/thm-linux-privesc-review.md) | Bounty Hacker, LazyAdmin, RootMe |
| [웹 퍼징/XSS/IDOR 복습](reports/web-fuzzing-xss-review-notes.md) | ffuf, gobuster, vHost, XSS 재현, IDOR |
| [AI/MCP Workflow](reports/ai-mcp-bughunting-workflow.md) | HexStrike, MCP, Codex/Cursor, OSINT self-audit |
| [B트랙 학습 맵](reports/b-track-learning-map.md) | 전체 학습 축과 포트폴리오 연결 |
| [KISA 수료 내역](reports/kisa-training-certificates.md) | KISA아카데미 교육 이수 내용 |
| [실습 범위와 보안 원칙](SECURITY.md) | 공개 범위, 마스킹 기준, 윤리 원칙 |

---

## 치트시트

- [실전 사용 치트시트](cheatsheets/field-cheatsheet.md)
- [Web Pentest Checklist](cheatsheets/web-pentest-checklist.md)
- [Web Pentest Commands](cheatsheets/web-pentest-commands.md)
- [Nmap Commands](cheatsheets/nmap-commands.md)
- [Pwn Checklist](cheatsheets/pwn-checklist.md)
- [GDB / pwndbg](cheatsheets/gdb-pwndbg.md)
- [IDA Free / 바이너리 분석](cheatsheets/ida-shortcuts.md)

---

## 완료된 작업

- [x] GitHub Pages 배포
- [x] Markdown 뷰어 구현
- [x] 보고서 검색/태그 필터/9개 단위 페이지 전환
- [x] 모바일 레이아웃 정리
- [x] 뷰어 목차 접기/펼치기
- [x] SQLi, XSS, 로그인 로직, 모바일 보고서 작성
- [x] THM Blue, Forest, Search 보강
- [x] THM The Cod Caper, THM ICE, THM Linux 복습 문서화
- [x] BOF01, BOF11, Reversing Solver 정리
- [x] Nessus/IDS, Windows LPE, AI/MCP 워크플로우 정리
- [x] KISA아카데미 수료 내역 정리
- [x] 깨진 한글 문서 복구

---

## 남은 보완 후보

| 후보 | 현재 기준 |
| --- | --- |
| HTB Cap | 전용 풀이 노트나 캡처 확보 후 작성 |
| HTB Meow | 전용 풀이 노트나 캡처 확보 후 작성 |
| HTB Expressway | 전용 풀이 노트나 캡처 확보 후 작성 |
| 모바일 캡처 추가 | secret/log 마스킹 가능한 이미지 확보 후 반영 |
| 탐지 룰 실습 강화 | pcap 기반 alert 결과가 있으면 Nessus/IDS 문서 보강 |

근거가 부족한 문서는 이름만 보고 억지로 작성하지 않고, 실제 풀이 기록이 확인될 때 추가합니다.

---

## GitHub 정보

- Repo: https://github.com/kang9863/security-portfolio
- Pages: https://kang9863.github.io/security-portfolio/
- Branch: `main`

## 최근 AI 구성과 팀 프로젝트

기존 공개 문서 34개에 AI와 팀 프로젝트 기록 7개를 추가했다. 현재 전체는 보고서·학습 기록 32개, 치트시트 7개, 안내 문서 2개로 총 41개다. 문서 수는 독립 프로젝트나 취약점 발견 수를 의미하지 않는다.

- [OWASP Juice Shop 팀 프로젝트와 AI 도구 활용](reports/juice-shop-team-project.md)
- [Multi LLM MCP 분석 워크벤치 구성](reports/multi-llm-mcp-workbench.md)
- [Qwen Python 런처와 공통 실행 설정](reports/qwen-python-runtime.md)
- [Claude Hub와 로컬 LLM 보안 분석 구성](reports/claude-local-orchestration.md)
- [AI 도구의 실행 상태와 증거 관리](reports/ai-execution-evidence.md)
- [AI 역할 분담과 검토 흐름 설계](reports/ai-role-orchestration-design.md)
- [AI 퀀트 오케스트레이터 구조 설계](reports/ai-quant-orchestrator-design.md)
