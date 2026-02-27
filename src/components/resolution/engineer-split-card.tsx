"use client";

import { useState } from "react";
import { Users, Check, SkipForward, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TeamMember {
  id: string;
  name: string;
}

interface EngineerSplitItem {
  id: string;
  type: string;
  sourceEntity: string;
  suggestedMatch: null;
  confidence: number;
  context: {
    totalAmount: number;
    transactionCount: number;
    transactionIds: string[];
    teamMembers: TeamMember[];
  } | null;
}

export function EngineerSplitCard({
  item,
  teamMembers,
  onResolve,
  onSkip,
}: {
  item: EngineerSplitItem;
  teamMembers: TeamMember[];
  onResolve: (
    id: string,
    decision: Record<string, unknown>
  ) => Promise<void>;
  onSkip: (id: string) => void;
}) {
  const members = item.context?.teamMembers ?? teamMembers;
  const totalAmount = item.context?.totalAmount ?? 0;
  const txnCount = item.context?.transactionCount ?? 0;

  const [splits, setSplits] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const splitTotal = Object.values(splits).reduce(
    (sum, val) => sum + (parseFloat(val) || 0),
    0
  );
  const isValid =
    splitTotal > 0 && Math.abs(splitTotal - totalAmount) < 0.01;

  const handleSave = async () => {
    setLoading(true);
    const engineerSplits = Object.entries(splits)
      .filter(([, val]) => parseFloat(val) > 0)
      .map(([teamMemberId, val]) => ({
        teamMemberId,
        amount: parseFloat(val),
      }));

    await onResolve(item.id, {
      action: "manual",
      engineerSplits,
    });
    setLoading(false);
  };

  return (
    <Card className="transition-all">
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-rose-100 text-rose-800">
              <Users className="mr-1 size-3" />
              Engineer Split
            </Badge>
            <span className="text-xs text-muted-foreground">
              ${totalAmount.toLocaleString()} across {txnCount} transaction{txnCount !== 1 ? "s" : ""}
            </span>
          </div>

          <p className="text-lg font-medium">&ldquo;{item.sourceEntity}&rdquo;</p>

          {/* Split form */}
          <div className="rounded-md border">
            <div className="grid grid-cols-[1fr_120px] gap-2 border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
              <span>Engineer</span>
              <span>Amount ($)</span>
            </div>
            {members.map((member) => (
              <div
                key={member.id}
                className="grid grid-cols-[1fr_120px] items-center gap-2 px-3 py-1.5"
              >
                <span className="text-sm">{member.name}</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={splits[member.id] ?? ""}
                  onChange={(e) =>
                    setSplits((prev) => ({
                      ...prev,
                      [member.id]: e.target.value,
                    }))
                  }
                  placeholder="0"
                  className="h-8 text-sm"
                />
              </div>
            ))}
            <div className="grid grid-cols-[1fr_120px] items-center gap-2 border-t bg-muted/50 px-3 py-2">
              <span className="text-sm font-medium">Total</span>
              <span
                className={`text-sm font-mono ${
                  isValid
                    ? "text-emerald-600"
                    : splitTotal > totalAmount
                      ? "text-destructive"
                      : "text-muted-foreground"
                }`}
              >
                ${splitTotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          {!isValid && splitTotal > 0 && (
            <p className="text-xs text-muted-foreground">
              Splits must total exactly ${totalAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
              {" "}(difference: ${Math.abs(splitTotal - totalAmount).toFixed(2)})
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSave}
              disabled={loading || !isValid}
              size="sm"
              className="gap-1"
            >
              <Check className="size-3.5" />
              Save Split
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSkip(item.id)}
              disabled={loading}
              className="gap-1 text-muted-foreground"
            >
              <SkipForward className="size-3.5" />
              Skip
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onResolve(item.id, { action: "reject" })}
              disabled={loading}
              className="gap-1 text-destructive ml-auto"
            >
              <X className="size-3.5" />
              Reject
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
