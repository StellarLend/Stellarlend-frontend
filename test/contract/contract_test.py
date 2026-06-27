import schemathesis
import pytest

base_url = "http://127.0.0.1:3000"

schema = schemathesis.from_path("openapi.yaml", base_url=base_url)

@pytest.fixture(scope="session")
def session():
    # Placeholder for stateful route setup (e.g., DB seeding, auth)
    # Extend this fixture as needed for specific endpoints.
    yield

@schema.parametrize()
def test_contract(case, session):
    # Execute generated request against the running Next.js server.
    # Any schema violation will cause the test to fail.
    case.call()
