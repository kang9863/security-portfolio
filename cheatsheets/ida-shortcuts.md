# IDA Free / 바이너리 분석

이 문서는 내가 리버싱 solver와 BOF 분석을 하면서 IDA Free에서 반복해서 사용한 단축키와 분석 흐름을 정리한 치트시트다. 목표는 “문자열 → xref → 함수 → 조건문/입력 처리 → solver” 흐름을 빠르게 잡는 것이다.

---

## 1. 자주 쓰는 단축키

| 단축키 | 용도 |
| --- | --- |
| `F5` | 디컴파일 뷰 |
| `Space` | 그래프 뷰 / 텍스트 뷰 전환 |
| `X` | xref 확인 |
| `N` | 이름 변경 |
| `/` | 인라인 주석 |
| `;` | 줄 주석 |
| `G` | 주소로 이동 |
| `Ctrl+G` | 점프 |
| `Ctrl+W` | 저장 |
| `Esc` | 이전 위치 |
| `Tab` | 디컴파일 / 어셈블리 전환 |
| `Alt+T` | 텍스트 검색 |
| `Alt+B` | 바이트 패턴 검색 |
| `Shift+F12` | Strings 창 |

---

## 2. 기본 분석 루틴

```text
1. 파일 로드 후 Auto Analysis 완료 대기
2. Functions 창에서 main 찾기
3. Strings 창에서 단서 문자열 확인
4. xref로 문자열 사용 위치 추적
5. F5로 디컴파일
6. 입력 처리 함수 확인
7. 비교/검증 로직 확인
8. 필요한 상수, 테이블, XOR 값 추출
9. Python solver로 재현
```

---

## 3. 문자열 기반 추적

확인할 문자열:

- `password`
- `admin`
- `correct`
- `wrong`
- `flag`
- `/bin/sh`
- 에러 메시지
- 메뉴 문구

왜 쓰는지:

문자열은 검증 함수나 분기 조건으로 가는 가장 빠른 단서다. `Shift+F12`로 문자열을 찾고 `X`로 사용 위치를 따라간다.

---

## 4. 취약 함수 / 입력 함수

```text
gets
strcpy
strcat
sprintf
scanf("%s")
read
recv
strcmp
memcmp
```

확인 포인트:

- 버퍼 크기
- 입력 길이 제한
- return address까지 거리
- 비교 함수의 인자
- 사용자 입력이 변환되는 과정

---

## 5. Solver 작성 흐름

```text
검증 함수 찾기
-> 입력 길이 확인
-> 루프 조건 확인
-> XOR/add/sub/rotate/table lookup 확인
-> 상수와 테이블 추출
-> Python으로 같은 로직 구현
-> 역연산 가능 여부 확인
-> 정답 문자열 검증
```

예시 골격:

```python
target = [0x12, 0x34, 0x56]
key = 0x41

answer = []
for value in target:
    answer.append(value ^ key)

print(bytes(answer))
```

주의점:

- 디컴파일 결과가 항상 원본 의도를 정확히 보여주지는 않는다.
- 헷갈리면 어셈블리 뷰와 GDB 동적 분석을 같이 본다.

---

## 6. BOF 분석에서 보는 것

```text
입력 함수
-> 지역 변수 크기
-> saved RBP 위치
-> return address까지 거리
-> win/system 함수 존재 여부
-> checksec 결과와 연결
```

주의점:

- IDA의 `var_XX`는 스택 오프셋 힌트일 뿐이다.
- 정확한 오프셋은 cyclic/GDB로 확인한다.

---

## 7. 기록 습관

보고서에는 다음을 남긴다.

- 분석한 함수 이름
- 문자열/xref 단서
- 핵심 조건문
- 입력 변환 로직
- solver 코드
- 검증 결과
