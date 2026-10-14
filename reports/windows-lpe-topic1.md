# Windows LPE Topic1 - 권한 모델 정리

## 1. 개요

Windows LPE(Local Privilege Escalation)를 이해하려면 exploit 코드보다 먼저 Windows 권한 모델을 알아야 한다.
이 문서는 사용자, 그룹, 토큰, 무결성 수준, UAC, 서비스 권한을 중심으로 로컬 권한 상승을 분석할 때 확인할
기준을 정리한 것이다.

## 2. 핵심 개념

| 개념 | 의미 |
| --- | --- |
| SID | 사용자/그룹을 식별하는 고유 ID |
| Access Token | 로그인한 사용자의 권한 정보가 담긴 객체 |
| Privilege | `SeImpersonatePrivilege` 같은 특수 권한 |
| Integrity Level | Low / Medium / High / System 무결성 수준 |
| UAC | 관리자 계정도 기본적으로 낮은 권한 토큰으로 실행하게 만드는 보호 장치 |
| ACL | 객체에 누가 어떤 접근을 할 수 있는지 정하는 권한 목록 |

## 3. Access Token 관점

Windows에서 프로세스는 사용자의 Access Token을 가지고 실행된다. 토큰에는 사용자 SID, 그룹 SID, 권한,
무결성 수준이 포함된다.

```cmd
whoami /user
whoami /groups
whoami /priv
```

확인할 항목:

- 현재 사용자가 Administrators 그룹인지
- 현재 프로세스가 Medium Integrity인지 High Integrity인지
- `SeImpersonatePrivilege`, `SeAssignPrimaryTokenPrivilege` 같은 권한이 있는지
- 권한이 있어도 Enabled 상태인지

## 4. UAC와 무결성 수준

관리자 계정으로 로그인했더라도 모든 프로세스가 곧바로 관리자 권한으로 실행되는 것은 아니다. UAC가 켜져 있으면
기본 프로세스는 Medium Integrity로 실행되고, 승인된 관리자 작업만 High Integrity로 올라간다.

```text
관리자 계정 로그인
  -> 기본 프로세스: Medium Integrity
  -> UAC 승인 또는 auto-elevate 흐름
  -> High Integrity 프로세스
  -> SYSTEM 권한 서비스/프로세스와 상호작용 가능성 확인
```

THM ICE 실습에서 UAC 우회와 SYSTEM migrate를 같이 다룬 이유도 이 구조 때문이다. 이미 세션이 있어도
현재 토큰이 낮으면 관리자 작업이나 credential dump가 제한될 수 있다.

## 5. Windows LPE 점검 루틴

```text
현재 사용자와 그룹 확인
  -> token privilege 확인
  -> integrity level 확인
  -> writable service / registry / scheduled task 확인
  -> unquoted service path 확인
  -> weak folder permission 확인
  -> exploit 가능성보다 재현 가능한 권한 오남용 먼저 판단
```

주요 명령:

```cmd
whoami /priv
whoami /groups
net user %USERNAME%
net localgroup administrators
sc query
icacls "C:\Path\To\Service"
schtasks /query /fo LIST /v
```

PowerShell에서는 다음 항목을 확인한다.

```powershell
Get-Process -IncludeUserName
Get-Service
Get-Acl "C:\Path\To\Service"
```

## 6. 자주 보는 권한 상승 후보

| 후보 | 확인 포인트 | 위험 |
| --- | --- | --- |
| Weak Service Permission | 서비스 실행 파일 또는 설정 변경 가능 | SYSTEM 서비스 hijack |
| Unquoted Service Path | 공백 포함 경로에 따옴표 없음 | 중간 경로 실행 파일 삽입 |
| AlwaysInstallElevated | MSI가 높은 권한으로 실행 | 악성 MSI로 권한 상승 |
| SeImpersonatePrivilege | 토큰 가장 가능 | Potato 계열 공격 가능 |
| Writable Scheduled Task | 작업 파일/명령 변경 가능 | 높은 권한 작업 탈취 |
| DLL Hijacking | 로드 경로에 쓰기 가능 | 높은 권한 프로세스 DLL 교체 |

## 7. 분석 시 주의점

- 관리자 그룹 소속과 High Integrity는 다르다.
- 권한 이름이 보여도 Disabled 상태면 바로 사용할 수 없을 수 있다.
- exploit suggester 결과는 후보일 뿐이며 OS 버전, 패치 상태, 권한 조건을 다시 확인해야 한다.
- 포트폴리오에는 실제 해시나 credential dump 결과를 남기지 않는다.
- LPE는 “취약점 번호”보다 현재 토큰과 객체 권한의 관계를 설명하는 것이 중요하다.

## 8. 대응 방안

- 서비스 실행 파일과 폴더 ACL 최소 권한 적용
- 서비스 경로에는 따옴표 사용
- `AlwaysInstallElevated` 비활성화
- 불필요한 특수 권한 제거
- 관리자 계정과 일반 계정 분리
- EDR/로그에서 서비스 변경, 예약 작업 변경, 권한 상승 시도 모니터링
- 정기적으로 `whoami /priv`, 서비스 ACL, 예약 작업, 레지스트리 설정 점검

## 9. 학습한 점

- Windows 권한 상승은 “관리자냐 아니냐”보다 토큰, 무결성 수준, privilege, 객체 ACL을 함께 봐야 한다.
- UAC는 완전한 보안 경계는 아니지만, 실제 공격 흐름에서는 현재 세션의 권한 범위를 크게 좌우한다.
- SYSTEM 권한 획득은 exploit 하나로 끝나는 것이 아니라 서비스, 토큰, 프로세스 권한 관계를 이용하는 경우가 많다.
- 웹/AD 실습과 마찬가지로 Windows LPE도 결국 “누가 어떤 객체에 어떤 권한을 가지고 있는가”를 추적하는 문제다.
