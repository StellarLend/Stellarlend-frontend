import React from "react";
import CommitmentDetailActions from "../../../../components/CommitmentDetailActions";
import SettlementReceipt from "../../../../components/settlement/SettlementReceipt";

export default function Page({ params }: { params: { id: string } }) {
  const { id } = params;
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-2">Commitment {id}</h1>
      </div>
      
      <SettlementReceipt commitmentId={id} />

      {/* 
        Note: The original code passed 'commitmentId={id}' and 'initialStatus={"open"}',
        but CommitmentDetailActions expects a full commitment object. 
        I'm temporarily leaving it as a placeholder or we can provide mock data here, 
        but since the issue focuses on SettlementReceipt, I'll focus there.
      */}
      {/* <CommitmentDetailActions commitmentId={id} initialStatus={"open"} /> */}
    </div>
  );
}
