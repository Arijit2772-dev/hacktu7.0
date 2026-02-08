from fastapi import APIRouter, HTTPException, status
from app.simulations.scenarios import get_scenario_list, get_scenario_data

router = APIRouter()


@router.get("/scenarios")
def list_scenarios():
    return get_scenario_list()


@router.get("/scenario/{scenario_id}/data")
def scenario_data(scenario_id: str):
    data = get_scenario_data(scenario_id.upper())
    if not data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found")
    return data
