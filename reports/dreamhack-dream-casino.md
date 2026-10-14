# DreamHack 라이트업 — Dream Casino (MT19937 난수 예측)

---

## 1. 개요

Dream Casino는 PHP의 `mt_rand()` 함수가 사용하는 Mersenne Twister(MT19937) 난수 생성기의  
seed 값을 역추적하여 다음 난수를 예측하는 문제입니다.  
충분한 난수 출력값을 수집하면 내부 상태를 복원하고 seed를 특정할 수 있습니다.

---

## 2. 문제 구조

```
웹 카지노 게임 사이트
  - 슬롯머신, 주사위 등 랜덤 결과 기반 게임
  - PHP mt_rand()로 결과 생성
  - 초기 seed: time() (현재 Unix timestamp)
  - 잔액이 일정 이상이면 FLAG 지급
```

---

## 3. 취약점 원리 — MT19937

### PHP mt_rand() 특성

- PHP `mt_rand()`는 Mersenne Twister를 사용
- seed로 `time()`(Unix timestamp)을 사용하면 seed 범위가 제한됨 (초 단위)
- 같은 seed에서 동일한 난수 시퀀스 생성 → **예측 가능**

### Seed 복원 방법

```
방법 1: Seed Brute-force
  - 요청 전후 수 초 범위의 timestamp를 모두 시도
  - PHP로 동일한 시퀀스를 재현하여 실제 출력과 대조

방법 2: php_mt_seed 도구 사용
  - 난수 출력값을 입력하면 seed를 역산
  - 도구: https://github.com/openwall/php_mt_seed
```

---

## 4. 공격 흐름

### 4.1 난수 출력값 수집

```python
import requests

url = "http://target/game"
session = requests.Session()

# 여러 번 게임 플레이하여 결과값 수집
results = []
for _ in range(10):
    r = session.get(url + "/play")
    results.append(r.json()["result"])

print(results)
# [3, 7, 2, 5, 1, 8, 4, 6, 3, 7]
```

### 4.2 Seed Brute-force

```python
import subprocess
import time

# 요청 시점 기준 ±10초 범위로 시도
target_time = int(time.time())

for seed in range(target_time - 10, target_time + 10):
    # PHP로 시뮬레이션
    php_code = f"<?php mt_srand({seed}); for($i=0;$i<10;$i++) echo mt_rand(1,8).',';"
    output = subprocess.check_output(["php", "-r", php_code]).decode().strip(",").split(",")
    
    if output[:3] == [str(r) for r in results[:3]]:
        print(f"Seed found: {seed}")
        print(f"Next values: {output}")
        break
```

### 4.3 php_mt_seed 사용

```bash
# 설치
git clone https://github.com/openwall/php_mt_seed
cd php_mt_seed && make

# 수집한 난수 첫 값으로 seed 역산
./php_mt_seed <첫번째_난수값>
# → Seed: 1706847231
```

### 4.4 다음 난수 예측 → 베팅으로 잔액 증가

```python
import subprocess

seed = 1706847231  # 발견한 seed

# 이미 소비된 난수 수만큼 건너뛰기
php_code = f"""<?php
mt_srand({seed});
for($i = 0; $i < {len(results)}; $i++) mt_rand(1, 8);
// 다음 10개 예측
for($i = 0; $i < 10; $i++) echo mt_rand(1, 8).',';
"""

next_values = subprocess.check_output(["php", "-r", php_code]).decode().strip(",").split(",")
print("예측된 다음 결과:", next_values)
```

### 4.5 예측값으로 베팅 반복 → 잔액 목표치 달성

```python
# 예측한 값에 전액 베팅 반복
for predicted in next_values:
    r = session.post(url + "/bet", json={"choice": predicted, "amount": balance})
    balance = r.json()["balance"]
    print(f"잔액: {balance}")

# 목표 잔액 달성 시 FLAG 요청
r = session.get(url + "/flag")
print(r.text)
```

---

## 5. 대응 방안

```php
// 취약 코드
mt_srand(time());
$result = mt_rand(1, 8);

// 방어 코드
// 1. 암호학적으로 안전한 난수 사용
$result = random_int(1, 8);  // CSPRNG 사용

// 2. 서버에서만 seed 관리, 클라이언트에 시퀀스 노출 최소화
```

- **`random_int()`**: PHP 7+ 에서 CSPRNG 기반 → 예측 불가
- **seed를 `time()`으로 설정 금지**: 예측 가능한 시드 사용 지양
- **결과값 직접 노출 최소화**: 패턴 수집 기회 제한

---

## 6. 학습한 점

- `mt_rand()`는 암호학적 안전성이 없음 — 결과값이 충분히 모이면 seed 역산 가능
- `time()` seed는 요청 시간을 알면 범위가 수십 초 이내 → brute-force 현실적
- `random_int()` vs `mt_rand()` 차이를 정확히 인지하는 것이 중요
- Gambling/Lottery 계열 웹앱에서 난수 예측 취약점은 실제 버그 바운티에서도 보고된 사례 있음
- PHP MT19937 seed 복원 도구(`php_mt_seed`)의 존재 — 이미 공개된 공격 도구
