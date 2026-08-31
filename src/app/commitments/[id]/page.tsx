import React from "react";
import CommitmentDetailActions from "../../../../components/CommitmentDetailActions";

export default function Page({ params }: { params: { id: string } }) {
  const { id } = params;
  return (
    <div>
      <h1>Commitment {id}</h1>
      <CommitmentDetailActions commitmentId={id} initialStatus={"open"} />
    </div>
  );
}
