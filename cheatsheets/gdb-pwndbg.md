# GDB / pwndbg

이 문서는 내가 BOF/ret2libc 실습을 하면서 GDB와 pwndbg에서 반복해서 사용한 명령어를 정리한 치트시트다. 단축키 암기보다 “크래시 확인 → 오프셋 계산 → 레지스터/스택 확인 → payload 수정” 흐름을 빠르게 반복하는 데 초점을 둔다.

---

## 1. 시작

```bash
gdb ./binary
gdb -q ./binary
gdb --args ./binary arg1 arg2
```

```gdb
set disassembly-flavor intel
```

왜 쓰는지:

- `-q`: 배너 없이 빠르게 시작한다.
- `--args`: 인자가 필요한 바이너리를 디버깅한다.
- Intel 문법은 IDA, pwndbg와 같이 보기 편하다.

---

## 2. 실행 제어

```gdb
run
run < input.txt
run <<< $(python3 -c "print('A'*100)")
continue
next
step
ni
si
finish
quit
```

| 명령어 | 용도 |
| --- | --- |
| `run` | 처음부터 실행 |
| `continue` | 다음 breakpoint까지 진행 |
| `next` | 함수 안으로 들어가지 않고 다음 줄 |
| `step` | 함수 안으로 들어감 |
| `ni` | 다음 instruction |
| `si` | instruction 단위 step |
| `finish` | 현재 함수가 끝날 때까지 실행 |

---

## 3. Breakpoint

```gdb
break main
break *0x401234
tbreak *0x401234
info breakpoints
delete 1
disable 1
enable 1
```

왜 쓰는지:

- 함수 이름, 주소, 특정 instruction 기준으로 멈춰서 입력 처리와 return 흐름을 본다.
- `tbreak`는 한 번만 멈추는 breakpoint라 반복 디버깅 때 편하다.

---

## 4. 레지스터 / 스택 / 메모리

```gdb
info registers
p/x $rsp
p/x $rip
x/20gx $rsp
x/40wx $rsp
x/s 0xADDRESS
x/i $rip
context
```

확인 포인트:

- `RIP`: 실행 흐름을 어디로 넘겼는지
- `RSP`: payload가 스택에 어떻게 놓였는지
- `RDI`, `RSI`, `RDX`: 함수 인자가 원하는 값인지
- `x/s`: 문자열 주소가 맞는지

---

## 5. 크래시 / 오프셋

```bash
pwn cyclic 200
pwn cyclic -l VALUE
```

```gdb
run <<< $(pwn cyclic 200)
info registers
```

왜 쓰는지:

- BOF에서 return address까지의 정확한 거리를 계산한다.
- pwndbg가 `cyclic -l` 힌트를 주는 경우도 있다.

주의점:

- 64-bit에서는 레지스터에 보이는 값의 바이트 순서를 확인한다.
- 오프셋이 이상하면 입력 끝의 newline, null byte, 함수별 길이 제한을 확인한다.

---

## 6. pwndbg에서 자주 쓰는 명령

```gdb
checksec
vmmap
plt
got
elf
rop
search /bin/sh
nearpc
telescope $rsp
canary
```

| 명령어 | 용도 |
| --- | --- |
| `checksec` | 보호기법 확인 |
| `vmmap` | 메모리 매핑과 base 주소 확인 |
| `plt`, `got` | 함수 호출/주소 테이블 확인 |
| `rop` | gadget 탐색 |
| `search /bin/sh` | 문자열 위치 찾기 |
| `telescope $rsp` | 스택을 포인터 형태로 보기 |

---

## 7. ret2libc 확인 루틴

```text
1. 오프셋 계산
2. pop rdi; ret gadget 확인
3. puts@plt로 puts@got leak
4. libc base 계산
5. system("/bin/sh") payload 구성
6. 로컬 재현
7. 원격 환경 차이 확인
```

주의점:

- `ret` gadget을 하나 추가해야 stack alignment 문제가 해결되는 경우가 있다.
- 원격 libc가 다르면 로컬 exploit이 실패할 수 있다.

---

## 8. 기록 습관

보고서에는 다음을 남긴다.

- 크래시 입력
- 오프셋 계산 근거
- 보호기법
- leak한 주소와 base 계산
- gadget과 payload 구조
- 최종 shell 또는 flag 재현 화면
