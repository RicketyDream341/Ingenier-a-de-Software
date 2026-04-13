from fastapi import APIRouter

from database import driver, node_to_dict

router = APIRouter()


@router.get("/users")
def list_users():
    query = """
    MATCH (u:User)
    RETURN u
    ORDER BY u.created_at DESC
    LIMIT 50
    """

    with driver.session() as session:
        result = session.run(query)
        users = []
        for record in result:
            user = node_to_dict(record["u"])
            user.pop("password_hash", None)
            users.append(user)
        return {"users": users}
