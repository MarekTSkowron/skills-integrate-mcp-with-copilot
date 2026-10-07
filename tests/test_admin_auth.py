import os
import unittest
from http.cookies import SimpleCookie
from unittest.mock import patch

from fastapi import HTTPException
from starlette.requests import Request
from starlette.responses import Response

from src import app as activities_app


def make_request(cookie=None):
    headers = []
    if cookie:
        headers.append((b"cookie", f"admin_session={cookie}".encode()))
    return Request(
        {
            "type": "http",
            "asgi": {"version": "3.0"},
            "http_version": "1.1",
            "method": "POST",
            "scheme": "http",
            "path": "/",
            "raw_path": b"/",
            "query_string": b"",
            "headers": headers,
            "server": ("test", 80),
            "client": ("test", 1),
            "root_path": "",
        }
    )


class AdminAuthTests(unittest.TestCase):
    def setUp(self):
        self.environment = patch.dict(
            os.environ,
            {
                "ADMIN_USERNAME": "teacher",
                "ADMIN_PASSWORD": "strong-test-password",
                "ADMIN_SESSION_SECRET": (
                    "test-session-secret-that-is-at-least-32-characters"
                ),
            },
        )
        self.environment.start()
        self.original_participants = {
            name: details["participants"][:]
            for name, details in activities_app.activities.items()
        }

    def tearDown(self):
        for name, participants in self.original_participants.items():
            activities_app.activities[name]["participants"][:] = participants
        self.environment.stop()

    def test_activities_are_public_but_registration_changes_require_staff(self):
        self.assertIn("Chess Club", activities_app.get_activities())

        with self.assertRaises(HTTPException) as signup_error:
            activities_app.signup_for_activity(
                "Chess Club", "student@mergington.edu", make_request()
            )
        with self.assertRaises(HTTPException) as unregister_error:
            activities_app.unregister_from_activity(
                "Chess Club", "michael@mergington.edu", make_request()
            )
        with self.assertRaises(HTTPException) as tampered_error:
            activities_app.signup_for_activity(
                "Chess Club", "student@mergington.edu", make_request("1.invalid")
            )

        self.assertEqual(signup_error.exception.status_code, 401)
        self.assertEqual(unregister_error.exception.status_code, 401)
        self.assertEqual(tampered_error.exception.status_code, 401)

    def test_staff_can_login_and_change_registrations(self):
        response = Response()
        result = activities_app.login_admin(
            activities_app.AdminLogin(
                username="teacher", password="strong-test-password"
            ),
            make_request(),
            response,
        )
        self.assertTrue(result["authenticated"])
        self.assertIn("httponly", response.headers["set-cookie"].lower())

        cookies = SimpleCookie()
        cookies.load(response.headers["set-cookie"])
        session = cookies[activities_app.ADMIN_SESSION_COOKIE].value
        request = make_request(session)
        self.assertTrue(activities_app.get_admin_session(request)["authenticated"])

        signup = activities_app.signup_for_activity(
            "Chess Club", "new-student@mergington.edu", request
        )
        unregister = activities_app.unregister_from_activity(
            "Chess Club", "new-student@mergington.edu", request
        )
        self.assertIn("Signed up", signup["message"])
        self.assertIn("Unregistered", unregister["message"])

        logout_response = Response()
        activities_app.logout_admin(make_request(), logout_response)
        self.assertIn("Max-Age=0", logout_response.headers["set-cookie"])

    def test_invalid_credentials_are_rejected(self):
        with self.assertRaises(HTTPException) as error:
            activities_app.login_admin(
                activities_app.AdminLogin(
                    username="teacher", password="wrong-password"
                ),
                make_request(),
                Response(),
            )
        self.assertEqual(error.exception.status_code, 401)

    def test_missing_configuration_disables_staff_login(self):
        with patch.dict(os.environ, {}, clear=True):
            session = activities_app.get_admin_session(make_request())
            self.assertFalse(session["configured"])
            with self.assertRaises(HTTPException) as error:
                activities_app.login_admin(
                    activities_app.AdminLogin(
                        username="teacher", password="password"
                    ),
                    make_request(),
                    Response(),
                )
        self.assertEqual(error.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
