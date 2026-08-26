import pytest

from ai_coach.coaching_state import CoachingStateService


class FakeCursor:
    def __init__(self, rows): self.rows = rows
    def sort(self, *args): return self
    async def to_list(self, n): return self.rows[:n]


class FakeCollection:
    def __init__(self): self.rows=[]
    async def create_index(self,*args,**kwargs): return None
    async def find_one(self, query, projection=None):
        for row in self.rows:
            if all(row.get(k)==v for k,v in query.items() if not isinstance(v,dict)): return {k:v for k,v in row.items() if not projection or k not in projection or projection.get(k)!=0}
        return None
    def find(self, query, projection=None):
        rows=[r for r in self.rows if all(r.get(k)==v for k,v in query.items() if not isinstance(v,dict))]
        return FakeCursor(rows)
    async def insert_one(self,row): self.rows.append(dict(row))
    async def update_one(self,query,update,upsert=False):
        row=next((r for r in self.rows if all(r.get(k)==v for k,v in query.items() if not isinstance(v,dict))),None)
        if row: row.update(update.get("$set",{}))
        elif upsert: self.rows.append(dict(update.get("$set",{})))


class FakeDB:
    def __init__(self):
        for name in ["ai_coach_player_state","ai_coach_goals","ai_coach_recommendations","ai_coach_training","ai_coach_coaching_events"]:
            setattr(self,name,FakeCollection())


@pytest.mark.asyncio
async def test_low_confidence_does_not_mutate():
    db=FakeDB(); svc=CoachingStateService(db)
    result=await svc.evolve_from_report("u1","m1",{"weaknesses":["serve"]},{"overall_confidence":0.2})
    assert result["mutated"] is False
    assert result["training_assignments"] if "training_assignments" in result else True


@pytest.mark.asyncio
async def test_grounded_report_creates_training():
    db=FakeDB(); svc=CoachingStateService(db)
    result=await svc.evolve_from_report("u1","m1",{
        "strengths":["return consistency"],
        "weaknesses":["third-shot drop"],
        "recommended_drills":[{"title":"Third-shot drop", "description":"10 controlled repetitions", "target":"8/10"}],
        "unavailable":[],
    },{"overall_confidence":0.9})
    assert result["mutated"] is True
    assert result["training_assignments"]
    assert "third-shot drop" in result["state"]["recurring_weaknesses"]
