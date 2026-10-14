# Nmap Commands

이 문서는 내가 HTB/THM/개인 랩에서 정찰 단계마다 사용한 Nmap 루틴을 정리한 치트시트다. 핵심은 “전체 포트 확인 → 열린 포트 추출 → 상세 스캔 → 서비스별 다음 행동 결정” 순서다.

---

## 1. 전체 TCP 포트 스캔

### 명령어

```bash
nmap -Pn -n --open -p- --max-retries 1 --min-rate 2000 IP -oA fullTcp
```

### 왜 쓰는지

- `-p-`: 전체 TCP 포트를 확인한다.
- `--open`: 열린 포트만 본다.
- `-Pn`: ping 차단 환경에서도 스캔한다.
- `-n`: DNS 역조회를 생략해 시간을 줄인다.
- `-oA`: `.nmap`, `.gnmap`, `.xml`을 같이 저장한다.

### 주의점

빠른 스캔은 누락 가능성이 있다. 결과가 이상하거나 중요한 대상이면 속도를 낮춰 재확인한다.

---

## 2. 열린 포트 추출

### 명령어

```bash
cat fullTcp.nmap | grep -i '/' | cut -d '/' -f 1
cat fullTcp.nmap | grep -i '/' | cut -d '/' -f 1 | paste -sd, -
```

### 왜 쓰는지

상세 스캔의 `-p` 옵션에 넣을 포트 목록을 빠르게 만든다.

### 암기 포인트

```text
grep으로 포트 줄 고르기
-> cut으로 포트 번호만 자르기
-> paste로 콤마 목록 만들기
```

---

## 3. 상세 스캔

### 명령어

```bash
nmap -Pn -n --open -p PORTS -sV -sC IP -oA tcpdetailed
nmap -p PORTS -sCV -O IP
```

### 왜 쓰는지

- `-sV`: 서비스와 버전 확인
- `-sC`: 기본 NSE 스크립트 실행
- `-O`: OS 추정

### 주의점

서비스 이름만 믿지 않는다. 배너, 웹 페이지, 스크립트 결과를 같이 확인한다.

---

## 4. UDP / 내부망 스캔

```bash
nmap -sU -p 53,67,68,69,123,161,500 IP
nmap -sn 10.10.10.0/24
nmap -p 22,80,443,445,3389 10.10.10.0/24
```

### 주의점

UDP는 느리고 오탐/미탐이 많다. 꼭 필요한 포트 위주로 확인한다.

---

## 5. 서비스별 NSE 스크립트

```bash
# SMB
nmap --script smb-vuln-ms17-010 -p 445 IP
nmap --script smb-enum-users,smb-enum-shares -p 445 IP

# HTTP
nmap --script http-title,http-headers,http-methods -p 80,443 IP

# LDAP
nmap --script ldap-search -p 389 IP

# FTP
nmap --script ftp-anon -p 21 IP
```

### 왜 쓰는지

서비스별로 기본 열거를 자동화해 다음 공격 표면을 좁힌다.

---

## 6. 포트별 다음 확인

| 포트 | 서비스 | 다음 확인 |
| --- | --- | --- |
| 21 | FTP | 익명 로그인, 파일 목록, 버전 |
| 22 | SSH | 버전, 키 인증, 크랙 가능성 |
| 53 | DNS | zone transfer, 내부 도메인 |
| 80/443 | HTTP/S | 기술 스택, 경로, 인증, 입력 지점 |
| 88 | Kerberos | AS-REP Roasting, Kerberoasting |
| 139/445 | SMB | 공유 열거, 익명 접근, MS17-010 |
| 389/636 | LDAP | 사용자/그룹 열거, 익명 바인드 |
| 3389 | RDP | 접근 가능 여부, 계정 정책 |
| 5985 | WinRM | `evil-winrm` 접속 가능성 |

---

## 7. 스캔 결과 정리 습관

```text
1. 열린 포트 목록
2. 서비스/버전
3. 익명 접근 가능 여부
4. 웹이면 URL/경로/기능
5. AD면 도메인/사용자/SMB/LDAP/Kerberos 단서
6. 다음 액션
```
