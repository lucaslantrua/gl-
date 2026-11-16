# Fixtures

**These images are synthetic placeholders, not real photos.**

They were generated with Pillow (`python tests/fixtures/make_placeholders.py`) so that the
upload path (multipart, content type, size, base64 forwarding) can be tested without shipping
real pictures. The vision model is always mocked in the test suite, so their content is irrelevant.

Replace them with real photos (JPEG or WebP, under 2 MB, same file names) before using them for
any manual or end-to-end evaluation of the prompts:

- `plates/` : 5 plate photos (pasta, rice + curry, burger + fries, salad + bread, breakfast + juice)
- `labels/` : 3 nutrition labels (FR, EN, DE)
