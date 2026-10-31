# atomb-log

개인 기록 블로그: https://atomb-log.github.io

Jekyll과 직접 만든 픽셀 테마를 사용합니다. 공개에 필요한 소스와 사용 중인
이미지만 포함하며, 로컬 백업·참고 이미지·인증 설정은 포함하지 않습니다.

## 글 작성

`_posts/YYYY-MM-DD-title.md`에 Markdown 파일을 추가합니다.

```yaml
---
title: "오늘 배운 것"
categories: [Paper]
tags: [노트]
---
```

카테고리는 `Stat`, `Math`, `Code`, `Paper`, `Memo`, `ABOUT`을 사용합니다.
코드 블록에는 `python` 또는 `r` 언어 이름을 지정하면 문법 강조가 적용됩니다.

## 배포

`main` 브랜치에 반영하면 GitHub Actions가 빌드하고 GitHub Pages에 게시합니다.
Pages의 Source는 **GitHub Actions**로 설정합니다.

로컬 확인: `bundle install` 후 `bundle exec jekyll serve`.
빌드 검증: `python scripts/check_site.py _site`.
