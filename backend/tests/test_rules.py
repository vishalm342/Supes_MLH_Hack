from backend.rules import detect


def _assert_valid(results, original):
    assert results == sorted(results, key=lambda item: item["start"])
    for index, item in enumerate(results):
        assert original[item["start"] : item["end"]] == item["text"]
        if index:
            assert results[index - 1]["end"] <= item["start"]


def test_email_exact_text_and_offsets():
    text = "Mail priya.r@henderson-logistics.com today"
    results = detect(text)
    assert len(results) == 1
    assert results[0]["type"] == "EMAIL"
    assert results[0]["text"] == "priya.r@henderson-logistics.com"
    _assert_valid(results, text)


def test_phone_formats():
    text = "Call +91 98400 12345 or +1 (415) 555-0132"
    results = detect(text)
    assert [item["type"] for item in results] == ["PHONE", "PHONE"]
    _assert_valid(results, text)


def test_ipv4():
    text = "Server 10.20.4.15 is down"
    results = detect(text)
    assert len(results) == 1
    assert results[0]["type"] == "IP_ADDRESS"
    assert results[0]["text"] == "10.20.4.15"
    _assert_valid(results, text)


def test_internal_url_suppresses_embedded_ip():
    text = "Open http://10.20.4.15:8080/admin"
    results = detect(text)
    assert [item["type"] for item in results] == ["INTERNAL_URL"]
    assert results[0]["text"] == "http://10.20.4.15:8080/admin"
    _assert_valid(results, text)


def test_public_url_not_internal():
    text = "See https://github.com/vishalm342/Supes_MLH_Hack"
    assert detect(text) == []


def test_api_key():
    text = "key sk_live_51HxQe9kLmN3pQrStUvWxYz"
    results = detect(text)
    assert len(results) == 1
    assert results[0]["type"] == "API_KEY"
    _assert_valid(results, text)


def test_aws_api_key():
    text = "AWS AKIAIOSFODNN7EXAMPLE"
    results = detect(text)
    assert len(results) == 1
    assert results[0]["type"] == "API_KEY"
    _assert_valid(results, text)


def test_jwt():
    text = "token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    results = detect(text)
    assert len(results) == 1
    assert results[0]["type"] == "JWT"
    _assert_valid(results, text)


def test_password_only_value():
    text = "DB_PASSWORD=Hunter2!x"
    results = detect(text)
    assert len(results) == 1
    assert results[0]["type"] == "PASSWORD"
    assert results[0]["text"] == "Hunter2!x"
    _assert_valid(results, text)


def test_card_luhn_valid():
    text = "card 4111 1111 1111 1111"
    results = detect(text)
    assert len(results) == 1
    assert results[0]["type"] == "CARD"
    _assert_valid(results, text)


def test_card_luhn_invalid():
    text = "card 4111 1111 1111 1112"
    assert not any(item["type"] == "CARD" for item in detect(text))


def test_pan():
    text = "PAN ABCDE1234F"
    results = detect(text)
    assert len(results) == 1
    assert results[0]["type"] == "GOV_ID"
    _assert_valid(results, text)


def test_year_and_short_number_not_phone():
    text = "Released in 2024 with 300 users"
    assert detect(text) == []


def test_medical_context_left_to_gemma():
    text = "The patient has diabetes"
    assert detect(text) == []


def test_aadhaar_and_ssn_are_government_ids():
    assert [item["type"] for item in detect("Aadhaar 2345 6789 0123")] == ["GOV_ID"]
    assert [item["type"] for item in detect("SSN 123-45-6789")] == ["GOV_ID"]


def test_overlap_priority_prefers_jwt_over_generic_api_key():
    jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk"
    results = detect(jwt)
    assert len(results) == 1
    assert results[0]["type"] == "JWT"
