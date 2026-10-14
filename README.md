# 강문식 모의해킹 취약점 분석 포트폴리오

여러 회사와 보안 직무 지원에 공통으로 사용할 수 있는 정적 GitHub Pages 포트폴리오입니다. 웹 취약점 분석, AD·시스템 실습, AI 도구 구성 사례와 공통 이력서를 연결합니다.

- 홈페이지: https://kang9863.github.io/security-portfolio/
- index.html: 소개·경험 분야·사례·분석 방식·교육·연락처
- case.html / case.js / data.json: 5개 사례와 역할·접근·근거·분석 범위
- assets/: 공통 이력서 Word·PDF, Forest 권한 경로 캡처, AI 워크벤치 구조도

## 로컬 미리보기

`python -m http.server 8042 --bind 127.0.0.1`

브라우저에서 http://127.0.0.1:8042/ 를 엽니다. JSON을 읽으므로 파일 더블클릭보다 HTTP 미리보기를 사용합니다.

## 내용 수정

사례 본문은 data.json, 소개·교육·이메일은 index.html, 디자인은 styles.css에서 수정합니다. 이력서를 수정하면 assets의 두 문서도 함께 갱신합니다.

교육·CTF·실습 기록의 범위를 명시하고, 고객사 수행·취득 자격·공식 인정 성과로 확대하지 않습니다. 공개 문서에 개인 인증 자료·토큰·비밀번호·flag를 추가하지 않습니다.

## 분야별 링크

- 웹 분석: https://kang9863.github.io/security-portfolio/?category=web#work
- AD·시스템: https://kang9863.github.io/security-portfolio/?category=system#work
- AI 도구: https://kang9863.github.io/security-portfolio/?category=ai#work

기업별 이력서는 로컬에서 별도로 관리합니다. 공개 assets에는 공통 이력서를 유지합니다.
