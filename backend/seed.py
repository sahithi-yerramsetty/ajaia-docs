from database import SessionLocal
from models import User

SEED_USERS = [
    ("alice@ajaia.dev", "Alice"),
    ("bob@ajaia.dev", "Bob"),
    ("carol@ajaia.dev", "Carol"),
]


def seed_users():
    db = SessionLocal()
    try:
        for email, name in SEED_USERS:
            if not db.query(User).filter_by(email=email).first():
                db.add(User(email=email, name=name))
        db.commit()
    finally:
        db.close()
