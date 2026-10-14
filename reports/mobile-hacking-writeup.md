# 모바일 앱 보안 분석 보고서 - jadx-gui + Frida

## 1. 개요

Android APK를 대상으로 정적 분석과 동적 분석을 결합해 모바일 앱 보안 취약점을 점검했다. `jadx-gui`로 앱의 Manifest, 클래스 구조, 문자열, 암호화 로직을 확인하고, Frida를 사용해 런타임에서 루팅 탐지와 복호화 함수를 후킹했다.

이 보고서는 OWASP UnCrackable Level 1과 AndroGoat 실습을 기반으로 모바일 버그헌팅에서 자주 확인하는 루팅 탐지 우회, 하드코딩된 민감정보, 취약한 로컬 저장소, 런타임 복호화 노출을 정리한 것이다.

## 2. 대상 / 환경

| 항목 | 내용 |
| --- | --- |
| 대상 | OWASP UnCrackable Level 1, AndroGoat |
| 플랫폼 | Android Emulator / 테스트용 루팅 환경 |
| 정적 분석 | jadx-gui |
| 동적 분석 | Frida, frida-tools |
| 보조 도구 | adb, logcat, Burp Suite |
| 분석 범위 | 허가된 실습용 앱과 로컬 테스트 환경 |

## 3. 분석 목적

- APK 내부 구조와 주요 진입점을 파악한다.
- 루팅/디버깅 탐지 로직이 클라이언트 측에서만 수행되는지 확인한다.
- 하드코딩된 키, URL, 토큰, 비밀번호 등 민감정보 노출 여부를 확인한다.
- 런타임 복호화 함수 후킹을 통해 민감값이 앱 실행 중 노출되는지 검증한다.
- 모바일 앱 취약점을 서버 측 검증, 안전한 저장소, 난독화, 인증서 검증 관점에서 대응 방안으로 정리한다.

## 4. 정적 분석

### 4.1 APK 구조 확인

```bash
jadx-gui UnCrackable-Level1.apk
```

정적 분석에서 먼저 확인한 항목은 다음과 같다.

| 항목 | 확인 내용 |
| --- | --- |
| `AndroidManifest.xml` | 패키지명, 권한, exported component, launcher activity |
| Activity / Class | 앱 실행 흐름, 입력 검증, 보안 체크 위치 |
| 문자열 검색 | URL, API key, 암호화 키, 에러 메시지, secret 관련 문자열 |
| 암호화 로직 | AES 모드, key 전달 방식, 복호화 함수 호출 위치 |

정적 분석에서는 “민감 문자열을 찾았다”에서 멈추지 않고, 그 값이 실제 인증/검증 로직에 쓰이는지까지
따라갔다. 포트폴리오 공개용 보고서에는 실제 secret 값을 그대로 남기지 않고, 어떤 클래스와 메서드에서
검증 흐름이 시작되는지, 어떤 조건을 만족하면 앱이 종료되거나 다음 화면으로 넘어가는지를 기록했다.

```text
Manifest 확인
  -> launcher activity 확인
  -> root/debug check class 검색
  -> 문자열과 crypto helper 검색
  -> 입력값 검증 함수와 비교 지점 확인
  -> Frida로 후킹할 후보 메서드 선정
```

### 4.2 루팅 탐지 로직

UnCrackable Level 1에서는 루팅 환경을 탐지하면 앱이 종료되는 흐름이 존재했다. jadx-gui로 확인한 탐지 기준은 주로 다음과 같았다.

```java
if (Build.TAGS != null && Build.TAGS.contains("test-keys")) {
    return true;
}

String[] paths = {
    "/system/xbin/su",
    "/system/bin/su",
    "/sbin/su"
};

for (String path : paths) {
    if (new File(path).exists()) {
        return true;
    }
}
```

이 로직은 클라이언트 내부 함수의 반환값에 의존하므로 Frida로 반환값을 조작할 수 있다.

### 4.3 복호화 함수 식별

정적 분석 중 암호화된 문자열을 복호화하는 메서드를 확인했다.

```java
public static String decrypt(byte[] key, byte[] encrypted) {
    SecretKeySpec keySpec = new SecretKeySpec(key, "AES");
    Cipher cipher = Cipher.getInstance("AES/ECB/PKCS7Padding");
    cipher.init(Cipher.DECRYPT_MODE, keySpec);
    return new String(cipher.doFinal(encrypted));
}
```

복호화 결과가 앱 내부 검증에 사용된다면, 함수 반환값을 후킹해 런타임에서 평문을 확인할 수 있다.

## 5. 동적 분석

### 5.1 Frida 연결

```bash
adb push frida-server /data/local/tmp/
adb shell "chmod 755 /data/local/tmp/frida-server"
adb shell "/data/local/tmp/frida-server &"
frida-ps -U
```

분석 대상 앱을 spawn 모드로 실행하면 앱 초기화 시점의 루팅 탐지도 우회할 수 있다.

```bash
frida -U -f owasp.mstg.uncrackable1 -l hook.js --no-pause
```

### 5.2 루팅 탐지 우회

루팅 탐지 함수의 반환값을 `false`로 고정해 앱 종료 흐름을 우회했다.

```javascript
Java.perform(function () {
  const RootCheck = Java.use("sg.vantagepoint.a.c");

  RootCheck.a.implementation = function () {
    console.log("[*] root check a() bypassed");
    return false;
  };

  RootCheck.b.implementation = function () {
    console.log("[*] root check b() bypassed");
    return false;
  };

  RootCheck.c.implementation = function () {
    console.log("[*] root check c() bypassed");
    return false;
  };
});
```

### 5.3 런타임 복호화 결과 추출

복호화 함수에 hook을 걸어 반환값을 출력했다.

```javascript
Java.perform(function () {
  const Crypto = Java.use("sg.vantagepoint.a.a");

  Crypto.a.overload("[B", "[B").implementation = function (key, encrypted) {
    const result = this.a(key, encrypted);
    console.log("[*] decrypted value: " + result);
    return result;
  };
});
```

이 방식은 정적 분석만으로 key와 encrypted byte array를 모두 추적하기 어려운 경우에도 런타임에서 실제 평문 값을 확인할 수 있게 해준다.

### 5.4 증거 로그 정리 기준

모바일 분석 결과는 캡처나 로그를 그대로 올리면 secret, token, 내부 URL이 노출될 수 있다. 그래서 공개용
포트폴리오에는 아래 기준으로 증거를 남긴다.

| 단계 | 남길 수 있는 증거 | 공개 시 처리 |
| --- | --- | --- |
| jadx-gui 분석 | 클래스명, 메서드명, 루팅 탐지 조건 | 실제 secret 문자열은 마스킹 |
| Frida 실행 | 후킹 성공 로그, 함수 호출 흐름 | 평문 결과값은 `<secret>`로 대체 |
| adb/logcat | 민감값 출력 여부, 로그 키워드 | 토큰/비밀번호/URL 일부 가림 |
| 네트워크 확인 | HTTP 사용 여부, 인증서 검증 흐름 | 실제 도메인과 세션값 제거 |

Frida 출력은 다음처럼 정리했다.

```text
[*] root check a() bypassed
[*] root check b() bypassed
[*] root check c() bypassed
[*] decrypted value: <secret>
```

이 부분은 실제 값보다 “클라이언트 내부 검증이 런타임에서 조작 가능했다”는 사실이 핵심이다.

## 6. 추가 점검 항목

AndroGoat 실습에서는 모바일 앱에서 반복적으로 발견되는 기초 취약점을 함께 점검했다.

| 항목 | 점검 관점 | 위험 |
| --- | --- | --- |
| 하드코딩된 자격증명 | Java/Kotlin 코드, 리소스, 문자열 검색 | API key, token, password 노출 |
| 취약한 SharedPreferences | 평문 저장 여부 | 로컬 파일 접근 시 민감정보 탈취 |
| Insecure Logging | `adb logcat` 민감값 출력 | 토큰/비밀번호/개인정보 노출 |
| 취약한 네트워크 통신 | HTTP 사용, 인증서 검증 미흡 | 중간자 공격 가능 |
| 클라이언트 측 검증 | 루팅 탐지, license check, secret 비교 | Frida로 우회 가능 |

```bash
adb logcat | grep -i "password\\|token\\|secret\\|key"
```

## 7. 영향도

| 구분 | 영향 |
| --- | --- |
| 기밀성 | 하드코딩된 key, 복호화된 secret, token, 로그 내 민감정보 노출 |
| 무결성 | Frida로 인증/검증 함수 반환값 조작 가능 |
| 인증 우회 | 클라이언트 측 루팅 탐지나 secret 비교만으로 보호된 기능은 우회 가능 |
| 네트워크 | 인증서 검증 미흡 시 Burp 프록시를 통한 요청/응답 관찰 가능 |
| 위험도 | 서버 측 검증 없이 앱 내부 검증에 의존하면 High로 평가 가능 |

## 8. 대응 방안

### 8.1 서버 측 검증 강화

루팅 탐지, 라이선스 체크, 권한 확인, 결제 검증 같은 중요한 판단은 앱 내부 함수만으로 결정하지 않는다. 모바일 앱은 공격자가 소유한 환경에서 실행되므로 클라이언트 로직은 변조될 수 있다는 전제로 설계해야 한다.

### 8.2 민감정보 하드코딩 금지

- API key, secret, private token을 APK 내부에 직접 저장하지 않는다.
- 앱에는 단기 토큰만 전달하고, 권한 판단은 서버에서 수행한다.
- 노출되어도 권한이 제한되도록 key scope와 만료 시간을 설정한다.

### 8.3 안전한 로컬 저장

- 민감정보는 Android Keystore 기반으로 보호한다.
- SharedPreferences에 평문 token/password를 저장하지 않는다.
- 로그 출력 전 민감값 마스킹을 적용한다.

### 8.4 네트워크 보호

- HTTPS를 기본으로 사용한다.
- 인증서 검증을 비활성화하지 않는다.
- 필요한 경우 certificate pinning을 적용하되, 서버 측 이상 탐지와 함께 사용한다.

## 9. 학습한 점

- 모바일 분석은 정적 분석만으로 끝나지 않고, 런타임에서 실제 값이 어떻게 만들어지는지 확인해야 한다.
- 루팅 탐지는 방어 신호일 뿐이며, 보안 판단의 최종 근거가 되면 우회 가능성이 크다.
- Frida는 취약점 악용 도구라기보다 “클라이언트 신뢰 경계가 어디서 깨지는지” 확인하는 분석 도구로 유용하다.
- 버그헌팅 보고서에서는 도구 사용법보다 취약한 신뢰 구조, 영향도, 서버 측 대응 방안을 명확히 쓰는 것이 중요하다.
- 캡처를 추가할 때는 앱 화면보다 `jadx-gui 분석 지점`, `Frida 후킹 성공 로그`, `logcat 민감값 출력 여부`처럼
  취약 구조를 설명하는 증거를 우선 남겨야 한다.
