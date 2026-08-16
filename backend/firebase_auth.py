"""Firebase Authentication helpers for Kuvira.

Firebase owns phone-number verification. FastAPI exchanges a verified Firebase
ID token for the application's existing Kuvira JWT and authorization model.
"""
import os
from typing import Optional

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials

from deps