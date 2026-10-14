# Pwn Checklist

이 체크리스트는 내가 BOF, ret2libc, pwntools 실습을 하면서 반복해서 확인한 순서다. 목표는 바이너리를 받았을 때 입력 지점, 보호기법, 오프셋, leak, payload 구조를 빠뜨리지 않는 것이다.

---

## 1. First Look

### 명령어

```bash
file ./chall
checksec ./chall
strings ./chall
readelf -a ./chall
objdump -d ./chall
```

### 왜 쓰는지

- `file`: 아키텍처와 stripped 여부 확인
- `checksec`: NX, Canary, PIE, RELRO 확인
- `strings`: `/bin/sh`, 에러 메시지, 메뉴 문자열 확인
- `readelf`, `objdump`: 심볼, 섹션, 함수 흐름 확인

### 주의점

보호기법을 먼저 확인해야 공격 전략이 정해진다. NX가 켜져 있으면 shellcode보다 ROP/ret2libc를 먼저 생각한다.

---

## 2. 입력 지점

확인할 입력:

- argv
- stdin
- file
- socket
- menu input
- `read`, `gets`, `fgets`, `scanf`, `recv`

### 막힌 포인트

입력 길이 제한이 있는 함수와 없는 함수를 구분한다. `gets`, 길이 제한 없는 `scanf("%s")`, 큰 `read`는 BOF 후보로 먼저 본다.

---

## 3. 오프셋 찾기

```bash
pwn cyclic 200
pwn cyclic -l 0x6161616b
```

### 왜 쓰는지

크래시가 난 값이 cyclic 패턴 안에서 몇 번째인지 찾아 리턴 주소까지의 거리를 계산한다.

### 주의점

64-bit에서는 값을 little endian으로 읽는 경우가 많다. GDB에서 보이는 값 그대로 넣었을 때 안 맞으면 바이트 순서를 확인한다.

---

## 4. 메모리 위치별 공격 아이디어

| 위치 | 공격 아이디어 |
| --- | --- |
| stack | BOF, return address overwrite |
| heap | UAF, double free, tcache poisoning |
| global/bss | function pointer overwrite, fake data |
| GOT | Partial/No RELRO일 때 GOT overwrite |
| libc | ret2libc, one gadget |

---

## 5. 보호기법별 전략

| 보호기법 | 필요한 전략 |
| --- | --- |
| NX | ROP 또는 ret2libc |
| Canary | Canary leak 또는 우회 |
| PIE | 바이너리 base leak |
| ASLR | libc/stack/heap leak |
| Full RELRO | GOT overwrite 회피 |
| seccomp | 허용 syscall 기반 ORW |

---

## 6. x86-64 Calling Convention

Function call:

```text
1st: RDI
2nd: RSI
3rd: RDX
4th: RCX
5th: R8
6th: R9
return: RAX
```

Syscall:

```text
syscall number: RAX
1st: RDI
2nd: RSI
3rd: RDX
4th: R10
5th: R8
6th: R9
```

---

## 7. ROP / ret2libc 루틴

```text
목표 함수 또는 syscall 결정
-> 필요한 인자 확인
-> calling convention 확인
-> gadget 검색
-> leak으로 필요한 주소 계산
-> payload 작성
-> 로컬 재현
-> 원격 재현
```

### pwntools 기본 골격

```python
from pwn import *

context.binary = elf = ELF("./chall")
p = process(elf.path)

payload = b"A" * OFFSET
payload += p64(RET)
payload += p64(POP_RDI)
payload += p64(next(elf.search(b"/bin/sh")))
payload += p64(elf.plt["system"])

p.sendline(payload)
p.interactive()
```

### 주의점

- 원격에서는 libc 버전이 다를 수 있다.
- payload가 로컬에서만 성공하면 환경 차이, newline, timeout, 주소 계산을 다시 본다.

---

## 8. 보고서에 남길 것

- 문제 목적
- 입력 방식
- 취약 함수와 취약 원인
- 보호기법
- 오프셋 계산
- leak 여부
- payload 구조
- 재현 결과
- 배운 점
