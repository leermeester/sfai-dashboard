"use client";

import { useState } from "react";
import {
  DollarSign,
  Check,
  X,
  SkipForward,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ResolutionItemData {
  id: string;
  type: string;
  sourceEntity: string;
  suggestedMatch: {
    id?: string;
    label: string;
    confidence: number;
    matchedOn?: string;
  } | null;
  confidence: number;
  context: Record<string, unknown> | null;
}

interface Customer {
  id: string;
  displayName: string;
}

export function ResolutionCard({
  item,
  customers,
  onResolve,
  onSkip,
}: {
  item: ResolutionItemData;
  customers: Customer[];
  onResolve: (
    id: string,
    decision: Record<string, unknown>
  ) => Promise<void>;
  onSkip: (id: string) => void;
}) {
  const [showAlternative, setShowAlternative] = useState(false);
  const [altCustomerId, setAltCustomerId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleApprove = async () => {
    setLoading(true);
    const decision: Record<string, unknown> = { action: "approve" };

    if (item.suggestedMatch) {
      decision.customerId = item.suggestedMatch.id;
    }

    await onResolve(item.id, decision);
    setLoading(false);
  };

  const handleAlternative = async () => {
    setLoading(true);
    await onResolve(item.id, { action: "manual", customerId: altCustomerId });
    setLoading(false);
  };

  const formatContext = () => {
    if (!item.context) return null;
    const parts: string[] = [];
    if (item.context.amount) {
      const amt = Math.abs(item.context.amount as number);
      parts.push(`$${amt.toLocaleString()}`);
    }
    if (item.context.postedAt) {
      parts.push(
        new Date(item.context.postedAt as string).toLocaleDateString()
      );
    }
    return parts.length > 0 ? parts.join(" · ") : null;
  };

  return (
    <Card className="transition-all">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            {/* Type badge + source entity */}
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                <DollarSign className="mr-1 size-3" />
                Unmatched Income
              </Badge>
              {item.context && formatContext() && (
                <span className="text-xs text-muted-foreground">
                  {formatContext()}
                </span>
              )}
            </div>

            {/* Source entity name */}
            <p className="text-lg font-medium">&ldquo;{item.sourceEntity}&rdquo;</p>

            {/* Suggestion */}
            {item.suggestedMatch && (
              <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2">
                <span className="text-sm text-muted-foreground">
                  Suggested:
                </span>
                <span className="text-sm font-medium">
                  {item.suggestedMatch.label}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${item.confidence}%`,
                        backgroundColor:
                          item.confidence >= 80
                            ? "#53a945"
                            : item.confidence >= 50
                              ? "#f0b449"
                              : "#e5484d",
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">
                    {item.confidence}%
                  </span>
                </div>
              </div>
            )}

            {/* Alternative picker */}
            {showAlternative && (
              <div className="flex items-center gap-2 rounded-md border px-3 py-2">
                <Select value={altCustomerId} onValueChange={setAltCustomerId}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Pick customer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button
                  size="sm"
                  onClick={handleAlternative}
                  disabled={loading || !altCustomerId}
                >
                  Save
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex items-center gap-2">
          {item.suggestedMatch && (
            <Button
              onClick={handleApprove}
              disabled={loading}
              size="sm"
              className="gap-1"
            >
              <Check className="size-3.5" />
              Approve
              <kbd className="ml-1 rounded bg-primary-foreground/20 px-1 py-0.5 text-[10px] font-mono">
                y
              </kbd>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAlternative(!showAlternative)}
            disabled={loading}
            className="gap-1"
          >
            <ChevronDown className="size-3.5" />
            Different match
            <kbd className="ml-1 rounded border px-1 py-0.5 text-[10px] font-mono">
              n
            </kbd>
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
            <kbd className="ml-1 rounded border px-1 py-0.5 text-[10px] font-mono">
              s
            </kbd>
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
      </CardContent>
    </Card>
  );
}
