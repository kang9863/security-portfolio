# 강문식 모의해킹 취약점 분석 포트폴리오

채용용 이력서와 대표 실습·분석 사례를 연결한 정적 GitHub Pages 사이트입니다.

- 홈페이지: https://kang9863.github.io/security-portfolio/
- index.html: 소개·사례·분석 방식·교육·연락처
- case.html / case.js / data.json: 5개 사례와 역할·접근·근거·분석 범위
- assets/: 공개용 이력서 Word·PDF와 Forest 권한 경로 캡처

## 로컬 미리보기

`python -m http.server 8042 --bind 127.0.0.1`

브라우저에서 http://127.0.0.1:8042/ 를 엽니다. JSON을 읽으므로 파일 더블클릭보다 HTTP 미리보기를 사용합니다.

## 내용 수정

사례 본문은 data.json, 소개·교육·이메일은 index.html, 디자인은 styles.css에서 수정합니다. 이력서를 수정하면 assets의 두 문서도 함께 갱신합니다.

교육·CTF·실습 기록의 범위를 명시하고, 고객사 수행·취득 자격·공식 인정 성과로 확대하지 않습니다. 공개 문서에 개인 인증 자료·토큰·비밀번호·flag를 추가하지 않습니다.
