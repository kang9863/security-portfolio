# 리버싱 Solver 정리 - IDA 분석 흐름과 Python 재구현

## 1. 개요

CTF 리버싱 문제에서 자주 나오는 입력 검증 로직을 IDA로 분석하고, 같은 로직을 Python solver로 재구현하는 흐름을 정리했다. 특정 문제의 플래그를 공개하는 목적이 아니라, 바이너리 안의 검증 조건을 어떻게 찾고, 어떻게 역으로 풀어낼 수 있는지 보여주는 포트폴리오용 문서다.

이 문서에서 다루는 패턴은 다음과 같다.

- 문자열과 cross-reference로 입력 검증 함수 찾기
- 디컴파일 코드에서 반복문과 비교 조건 읽기
- XOR key, 상수 배열, lookup table 추출
- 검증 로직을 Python으로 다시 구현하기
- 비슷한 리버싱 문제에 재사용할 solver 템플릿 만들기

## 2. 분석 환경

| 항목 | 사용 목적 |
| --- | --- |
| IDA Free | 정적 분석, pseudocode 확인, xref 추적 |
| Python 3 | solver 작성, 간단한 brute force |
| x64dbg / GDB | breakpoint와 런타임 값 확인 |
| strings / objdump | IDA를 열기 전 빠른 1차 확인 |

아래 예시는 실제 플래그나 비공개 문제 상수를 그대로 쓰지 않고, 포트폴리오에 공개 가능한 샘플 값으로 정리했다.

## 3. 분석 목표

초급/중급 리버싱 문제는 보통 사용자 입력을 받은 뒤 내부 조건과 비교한다. 이때 내가 먼저 확인하는 질문은 세 가지다.

```text
1. 사용자 입력은 어디서 들어오는가?
2. 성공/실패를 결정하는 함수는 어디인가?
3. 검증 로직을 역으로 풀거나 Python으로 재현할 수 있는가?
```

solver가 만들어야 하는 최종 결과는 원본 바이너리의 검증 조건을 만족하는 입력값이다.

## 4. IDA 정적 분석 루틴

기본적으로는 다음 순서로 분석한다.

```text
1. 바이너리를 IDA에 로드하고 auto analysis가 끝날 때까지 기다린다.
2. main 또는 runtime 초기화 직후의 사용자 코드 진입점을 찾는다.
3. Strings에서 "Correct", "Wrong", "flag", "password" 같은 문구를 찾는다.
4. 해당 문자열의 xref를 따라가 성공/실패 분기 위치를 확인한다.
5. F5로 pseudocode를 보고 변수명과 함수명을 분석하기 쉽게 바꾼다.
6. strcmp, memcmp, strncmp 또는 직접 구현된 loop 비교를 확인한다.
7. 상수 배열, key byte, table, 길이 조건을 추출한다.
8. Python으로 같은 로직을 구현하고 결과를 테스트한다.
```

자주 쓰는 IDA 기능:

| 기능 | 목적 |
| --- | --- |
| `Shift+F12` | 문자열 목록 확인 |
| `X` | 문자열/함수 참조 위치 확인 |
| `F5` | pseudocode 확인 |
| `N` | 변수명/함수명 변경 |
| `/` 또는 `;` | 분석 메모 추가 |
| `Space` | graph view와 linear view 전환 |

## 5. 패턴 1 - 고정 XOR 검증

가장 기본적인 패턴은 입력의 각 byte에 XOR 연산을 적용한 뒤, 인코딩된 배열과 비교하는 방식이다.

### 디컴파일 예시

```c
int check(char *input) {
    unsigned char enc[16] = {
        0x55, 0x4a, 0x41, 0x45, 0x5a, 0x54, 0x46, 0x5c,
        0x41, 0x5a, 0x40, 0x51, 0x44, 0x55, 0x1a, 0x00
    };

    if (strlen(input) != 15)
        return 0;

    for (int i = 0; i < 15; i++) {
        if ((input[i] ^ 0x23) != enc[i])
            return 0;
    }

    return 1;
}
```

### 분석 포인트

XOR은 같은 key를 다시 XOR하면 원래 값으로 돌아온다.

```text
encoded = plain ^ key
plain   = encoded ^ key
```

따라서 `enc` 배열과 key를 추출하면 입력값을 바로 복원할 수 있다.

### Python solver

```python
enc = [
    0x55, 0x4a, 0x41, 0x45, 0x5a, 0x54, 0x46, 0x5c,
    0x41, 0x5a, 0x40, 0x51, 0x44, 0x55, 0x1a
]

key = 0x23
answer = bytes([byte ^ key for byte in enc])

print(answer.decode())
```

## 6. 패턴 2 - 위치 기반 key

입력 위치에 따라 key가 달라지는 경우도 많다. key 배열을 반복해서 쓰거나, index 값을 연산에 섞는 방식이다. 그래도 연산이 deterministic하면 대부분 solver로 재구현할 수 있다.

### 디컴파일 예시

```c
unsigned char enc[12] = {
    0x34, 0x38, 0x2f, 0x25, 0x2d, 0x78,
    0x21, 0x2f, 0x31, 0x24, 0x72, 0x7f
};

unsigned char key[4] = { 0x41, 0x52, 0x33, 0x21 };

for (int i = 0; i < 12; i++) {
    if ((input[i] ^ key[i % 4]) != enc[i])
        return 0;
}
```

### Python solver

```python
enc = [0x34, 0x38, 0x2f, 0x25, 0x2d, 0x78, 0x21, 0x2f, 0x31, 0x24, 0x72, 0x7f]
key = [0x41, 0x52, 0x33, 0x21]

answer = bytes([
    enc[i] ^ key[i % len(key)]
    for i in range(len(enc))
])

print(answer.decode(errors="replace"))
```

## 7. 패턴 3 - S-box / Lookup Table

lookup table을 사용하는 경우에는 먼저 table이 one-to-one인지 확인한다. 출력값 하나가 입력값 하나로만 대응된다면 역방향 table을 만들어 풀 수 있다.

### 로직 예시

```c
unsigned char sbox[256] = { /* table omitted */ };
unsigned char target[8] = { 0x8c, 0x1f, 0xa2, 0x40, 0x99, 0x11, 0x76, 0x03 };

for (int i = 0; i < 8; i++) {
    if (sbox[(unsigned char)input[i]] != target[i])
        return 0;
}
```

### solver 접근

```python
sbox = [
    # IDA data view에서 추출한 값
    # 실제 solver에서는 256개 값을 모두 넣는다.
]

target = [0x8c, 0x1f, 0xa2, 0x40, 0x99, 0x11, 0x76, 0x03]

reverse = {}
for index, value in enumerate(sbox):
    reverse.setdefault(value, []).append(index)

answer = []
for value in target:
    candidates = reverse.get(value, [])
    if not candidates:
        raise ValueError(f"no candidate for {value:#x}")
    answer.append(candidates[0])

print(bytes(answer))
```

후보가 여러 개 나오는 경우에는 printable ASCII, 예상 flag format, 길이 조건, breakpoint에서 확인한 중간값을 이용해 범위를 줄인다.

## 8. 디버깅 확인 지점

정적 분석만으로 충분하지 않을 때는 breakpoint를 걸어 런타임 값을 확인한다. 내가 주로 확인하는 위치는 다음과 같다.

- `strcmp`, `memcmp`, `strncmp`
- 성공/실패 메시지를 출력하는 함수
- 비교 loop에서 `return 0`으로 빠지는 분기
- 변환된 입력값과 상수 배열이 비교되는 지점

확인 질문:

- 원본 입력을 비교하는가, 변환된 buffer를 비교하는가?
- 실제 비교 전에 고정 길이 조건이 있는가?
- 틀린 byte가 나오면 바로 종료하는가?
- 값이 signed byte로 처리되는가, unsigned byte로 처리되는가?
- table이 `.rodata`에 있는가, stack에 생기는가, runtime에 생성되는가?

## 9. 재사용 solver 템플릿

```python
from itertools import product


def fixed_xor_solver(enc, key):
    return bytes(byte ^ key for byte in enc)


def repeating_xor_solver(enc, key):
    return bytes(enc[i] ^ key[i % len(key)] for i in range(len(enc)))


def brute_force_printable(check_func, length, charset=None):
    if charset is None:
        charset = b"abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789{}_!-"

    for candidate in product(charset, repeat=length):
        data = bytes(candidate)
        if check_func(data):
            return data

    return None


def check_candidate(data):
    # 바이너리의 검증 로직을 여기에 재구현한다.
    return data.startswith(b"FLAG{") and data.endswith(b"}")


if __name__ == "__main__":
    enc = [0x55, 0x4a, 0x41, 0x45]
    print(fixed_xor_solver(enc, 0x23))
```

## 10. 보고서 작성 기준

포트폴리오에 리버싱 풀이를 올릴 때는 플래그 공개보다 분석 흐름을 우선한다.

- 어떤 단서로 검증 함수를 찾았는가?
- 어떤 연산 때문에 역산이 가능했는가?
- 어떤 상수, key, table을 추출했는가?
- solver 결과를 어떻게 검증했는가?
- 이 패턴이 방어 관점에서 어떤 의미가 있는가?

## 11. 학습한 점

리버싱 solver 작성은 바이너리 분석과 자동화를 연결하는 작업이었다. IDA로 프로그램의 판단 로직을 이해하고, Python으로 그 판단을 빠르게 재현하면 풀이 과정이 훨씬 명확해진다.

중요한 것은 특정 트릭 하나를 외우는 것이 아니라, 처음 보는 검증 코드를 작은 모델로 바꿔서 테스트하고 설명하는 능력이라고 느꼈다.
