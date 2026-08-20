"""Longitudinal coaching state and adaptive-training persistence helpers."""
from __future__ import annotations
import hashlib
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def now_iso() -> str: return datetime.now(timezone.utc).isoformat()
def _norm(text: Any) -> str: return re.sub(r"\s+", " ", str(text or "").strip().lower())
def _fingerprint(*parts: Any) -> str: return hashlib.sha256("|".join(_norm(x) for x in parts).encode("utf-8")).hexdigest()[:24]

def _unique_strings(values: List[Any], limit: int = 8) -> List[str]:
    out=[]; seen=set()
    for value in values:
        text=str(value or "").strip(); key=text.lower()
        if text and key not in seen: out.append(text); seen.add(key)
        if len(out)>=limit: break
    return out


class CoachingStateService:
    def __init__(self, db: Any): self.db = db

    async def ensure_indexes(self) -> None:
        await self.db.ai_coach_player_state.create_index("user_id", unique=True)
        await self.db.ai_coach_goals.create_index([("user_id", 1), ("status", 1)])
        await self.db.ai_coach_recommendations.create_index([("user_id", 1), ("created_at", -1)])
        await self.db.ai_coach_recommendations.create_index([("user_id", 1), ("fingerprint", 1)])
        await self.db.ai_coach_training.create_index([("user_id", 1), ("created_at", -1)])
        await self.db.ai_coach_training.create_index([("user_id", 1), ("status", 1)])
        await self.db.ai_coach_training.create_index([("user_id", 1), ("fingerprint", 1)])
        await self.db.ai_coach_coaching_events.create_index([("user_id", 1), ("created_at", -1)])

    async def get_state(self, user_id: str) -> Dict[str, Any]:
        await self.ensure_indexes()
        doc=await self.db.ai_coach_player_state.find_one({"user_id":user_id},{"_id":0})
        if doc: return doc
        empty={"user_id":user_id,"goals":[],"active_focus":[],"strengths":[],"weaknesses":[],"recurring_weaknesses":[],"improving_areas":[],"regressions":[],"previous_recommendations":[],"training_assignments":[],"training_completion":{},"training_outcomes":[],"training_adherence":{},"recommendation_effectiveness":{},"last_analyzed_match_id":None,"last_state_transition":None,"updated_at":now_iso()}
        await self.db.ai_coach_player_state.insert_one(empty.copy()); return empty

    async def upsert_state(self, user_id: str, patch: Dict[str, Any]) -> Dict[str, Any]:
        await self.ensure_indexes(); await self.db.ai_coach_player_state.update_one({"user_id":user_id},{"$set":{**patch,"updated_at":now_iso()}},upsert=True); return await self.get_state(user_id)

    async def add_goal(self,user_id:str,title:str,target:Optional[str]=None,due_at:Optional[str]=None)->Dict[str,Any]:
        await self.ensure_indexes(); goal={"id":f"goal-{int(datetime.now(timezone.utc).timestamp()*1000000)}","user_id":user_id,"title":title,"target":target,"due_at":due_at,"status":"active","created_at":now_iso()}; await self.db.ai_coach_goals.insert_one(goal.copy()); goals=await self.db.ai_coach_goals.find({"user_id":user_id,"status":"active"},{"_id":0}).sort("created_at",-1).to_list(50); await self.upsert_state(user_id,{"goals":goals}); return goal

    async def update_goal(self,user_id:str,goal_id:str,status:str)->Optional[Dict[str,Any]]:
        await self.ensure_indexes(); await self.db.ai_coach_goals.update_one({"id":goal_id,"user_id":user_id},{"$set":{"status":status,"updated_at":now_iso()}}); result=await self.db.ai_coach_goals.find_one({"id":goal_id,"user_id":user_id},{"_id":0}); goals=await self.db.ai_coach_goals.find({"user_id":user_id,"status":"active"},{"_id":0}).sort("created_at",-1).to_list(50); await self.upsert_state(user_id,{"goals":goals}); return result

    async def record_recommendation(self,user_id:str,match_id:Optional[str],payload:Dict[str,Any],source:str="agent")->Dict[str,Any]:
        await self.ensure_indexes(); title=payload.get("title") or payload.get("focus") or "training"; fingerprint=payload.get("fingerprint") or _fingerprint(title,payload.get("description"),payload.get("target")); existing=await self.db.ai_coach_recommendations.find_one({"user_id":user_id,"fingerprint":fingerprint},{"_id":0});
        if existing: return existing
        doc={"id":f"rec-{int(datetime.now(timezone.utc).timestamp()*1000000)}","user_id":user_id,"match_id":match_id,"source":source,"fingerprint":fingerprint,"created_at":now_iso(),**payload}; await self.db.ai_coach_recommendations.insert_one(doc.copy()); return doc

    async def assign_training(self,user_id:str,recommendation:Dict[str,Any],match_id:Optional[str]=None)->Dict[str,Any]:
        await self.ensure_indexes(); title=recommendation.get("title") or recommendation.get("focus") or "Training session"; fingerprint=recommendation.get("fingerprint") or _fingerprint(title,recommendation.get("description"),recommendation.get("target")); existing=await self.db.ai_coach_training.find_one({"user_id":user_id,"fingerprint":fingerprint,"status":{"$in":["assigned","in_progress"]}},{"_id":0});
        if existing: return existing
        doc={"id":f"training-{int(datetime.now(timezone.utc).timestamp()*1000000)}","user_id":user_id,"match_id":match_id,"fingerprint":fingerprint,"title":title,"description":recommendation.get("description",""),"target":recommendation.get("target"),"status":"assigned","outcome":None,"created_at":now_iso(),"completed_at":None}; await self.db.ai_coach_training.insert_one(doc.copy()); return doc

    async def evolve_from_report(self,user_id:str,match_id:str,report:Dict[str,Any],data_quality:Optional[Dict[str,Any]]=None)->Dict[str,Any]:
        await self.ensure_indexes(); dq=data_quality or report.get("data_quality") or {}; overall=float(dq.get("overall_confidence",0.0) or 0.0); unavailable=set(report.get("unavailable") or []); evidence_gate=overall>=0.5 and not unavailable.intersection({"strengths_require_more_evidence","weaknesses_require_more_evidence","tactical_observations_require_more_evidence"}); state=await self.get_state(user_id); previous_weaknesses=list(state.get("recurring_weaknesses") or []); previous_improving=list(state.get("improving_areas") or []); strengths=_unique_strings(report.get("strengths") or []); weaknesses=_unique_strings(report.get("weaknesses") or []); drills=report.get("recommended_drills") or []); transition={"match_id":match_id,"confidence":overall,"evidence_gate":evidence_gate,"strengths_count":len(strengths),"weaknesses_count":len(weaknesses),"drills_count":len(drills)}
        await self.record_coaching_event(user_id,"match_report",transition)
        if not evidence_gate: return {"state":state,"mutated":False,"reason":"insufficient_evidence","transition":transition}
        recurring=_unique_strings(previous_weaknesses+weaknesses); improving=_unique_strings(previous_improving+strengths); focus=_unique_strings(weaknesses[:3]+previous_weaknesses[:2],5); regressions=_unique_strings([w for w in weaknesses if _norm(w) in {_norm(x) for x in previous_weaknesses}],5)
        assignments=[]
        for drill in drills[:5]:
            if not isinstance(drill,dict): continue
            recommendation=dict(drill); recommendation["fingerprint"]=_fingerprint(drill.get("title"),drill.get("description"),drill.get("target")); rec=await self.record_recommendation(user_id,match_id,recommendation); assignments.append(await self.assign_training(user_id,rec,match_id))
        all_training=await self.db.ai_coach_training.find({"user_id":user_id},{"_id":0}).sort("created_at",-1).to_list(100)
        outcomes=[x for x in all_training if x.get("outcome") is not None or x.get("status") in {"completed","skipped"}]
        completion={"assigned":len(all_training),"completed":sum(x.get("status")=="completed" for x in all_training),"skipped":sum(x.get("status")=="skipped" for x in all_training)}
        completion["completion_rate"]=round(completion["completed"]/completion["assigned"],4) if completion["assigned"] else 0.0
        new_state=await self.upsert_state(user_id,{"active_focus":focus,"strengths":strengths,"weaknesses":weaknesses,"recurring_weaknesses":recurring,"improving_areas":improving,"regressions":regressions,"previous_recommendations":await self.db.ai_coach_recommendations.find({"user_id":user_id},{"_id":0}).sort("created_at",-1).to_list(20),"training_assignments":all_training,"training_completion":completion,"training_outcomes":outcomes,"training_adherence":completion,"last_analyzed_match_id":match_id,"last_state_transition":transition})
        await self.record_coaching_event(user_id,"state_transition",{**transition,"active_focus":focus,"training_assignment_ids":[x["id"] for x in assignments]})
        return {"state":new_state,"mutated":True,"training_assignments":assignments,"transition":transition}

    async def record_training_outcome(self,user_id:str,training_id:str,status:str,outcome:Optional[Dict[str,Any]]=None)->Optional[Dict[str,Any]]:
        await self.ensure_indexes(); completed_at=now_iso() if status in {"completed","skipped"} else None; await self.db.ai_coach_training.update_one({"id":training_id,"user_id":user_id},{"$set":{"status":status,"outcome":outcome,"completed_at":completed_at,"updated_at":now_iso()}}); doc=await self.db.ai_coach_training.find_one({"id":training_id,"user_id":user_id},{"_id":0})
        if doc:
            await self._refresh_adherence(user_id); await self.record_coaching_event(user_id,"training_outcome",{"training_id":training_id,"status":status,"outcome":outcome})
        return doc

    async def _refresh_adherence(self,user_id:str)->None:
        rows=await self.db.ai_coach_training.find({"user_id":user_id},{"_id":0,"status":1}).to_list(500); assigned=len(rows); completed=sum(r.get("status")=="completed" for r in rows); skipped=sum(r.get("status")=="skipped" for r in rows); rate=completed/assigned if assigned else 0.0; await self.upsert_state(user_id,{"training_adherence":{"assigned":assigned,"completed":completed,"skipped":skipped,"completion_rate":round(rate,4)}})

    async def record_coaching_event(self,user_id:str,event_type:str,payload:Dict[str,Any])->None:
        await self.ensure_indexes(); await self.db.ai_coach_coaching_events.insert_one({"user_id":user_id,"type":event_type,"payload":payload,"created_at":now_iso()})
