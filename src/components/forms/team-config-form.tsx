"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Save, Trash2, Wand2 } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  role: string;
  hourlyRate: number | null;
  monthlyCost: number | null;
  isActive: boolean;
  linearUserId: string | null;
  mercuryCounterparty: string | null;
}

export function TeamConfigForm({
  members: initialMembers,
}: {
  members: TeamMember[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [counterpartyOptions, setCounterpartyOptions] = useState<
    Array<{ name: string; totalAmount: number; txCount: number }>
  >([]);

  useEffect(() => {
    fetch("/api/settings/team/suggest-counterparties")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.allCounterparties) {
          setCounterpartyOptions(data.allCounterparties);
        }
      })
      .catch(() => {});
  }, []);

  function addMember() {
    setMembers((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        name: "",
        email: null,
        role: "engineer",
        hourlyRate: null,
        monthlyCost: null,
        isActive: true,
        linearUserId: null,
        mercuryCounterparty: null,
      },
    ]);
  }

  function updateMember(
    index: number,
    field: string,
    value: string | number | null
  ) {
    setMembers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function removeMember(index: number) {
    setMembers((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleAutoDetect() {
    setDetecting(true);
    try {
      const res = await fetch("/api/settings/team/suggest-counterparties");
      if (!res.ok) return;
      const data = await res.json();
      const suggestions: Array<{
        teamMemberId: string;
        suggestedCounterparty: string | null;
        confidence: number;
      }> = data.suggestions;

      setMembers((prev) =>
        prev.map((member) => {
          // Skip if already has a counterparty set
          if (member.mercuryCounterparty) return member;
          const suggestion = suggestions.find(
            (s) => s.teamMemberId === member.id && s.suggestedCounterparty && s.confidence >= 50
          );
          if (!suggestion) return member;
          return { ...member, mercuryCounterparty: suggestion.suggestedCounterparty };
        })
      );
    } finally {
      setDetecting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/team", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ members }),
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Monthly Cost ($)</TableHead>
              <TableHead>Hourly Rate ($)</TableHead>
              <TableHead>Linear User ID</TableHead>
              <TableHead>Mercury Counterparty</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member, index) => (
              <TableRow key={member.id}>
                <TableCell>
                  <Input
                    value={member.name}
                    onChange={(e) =>
                      updateMember(index, "name", e.target.value)
                    }
                    placeholder="Full name"
                    className="min-w-[120px]"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={member.email ?? ""}
                    onChange={(e) =>
                      updateMember(
                        index,
                        "email",
                        e.target.value || null
                      )
                    }
                    placeholder="email@example.com"
                    className="min-w-[160px]"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={member.role}
                    onValueChange={(val) =>
                      updateMember(index, "role", val)
                    }
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cofounder">Cofounder</SelectItem>
                      <SelectItem value="engineer">Engineer</SelectItem>
                      <SelectItem value="freelance">Freelance</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={member.monthlyCost ?? ""}
                    onChange={(e) =>
                      updateMember(
                        index,
                        "monthlyCost",
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    placeholder="0"
                    className="min-w-[100px]"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    value={member.hourlyRate ?? ""}
                    onChange={(e) =>
                      updateMember(
                        index,
                        "hourlyRate",
                        e.target.value ? parseFloat(e.target.value) : null
                      )
                    }
                    placeholder="0"
                    className="min-w-[100px]"
                  />
                </TableCell>
                <TableCell>
                  <Input
                    value={member.linearUserId ?? ""}
                    onChange={(e) =>
                      updateMember(
                        index,
                        "linearUserId",
                        e.target.value || null
                      )
                    }
                    placeholder="Linear ID"
                    className="min-w-[120px]"
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={member.mercuryCounterparty ?? "__none__"}
                    onValueChange={(val) =>
                      updateMember(
                        index,
                        "mercuryCounterparty",
                        val === "__none__" ? null : val
                      )
                    }
                  >
                    <SelectTrigger className="min-w-[200px]">
                      <SelectValue placeholder="Select counterparty" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— None —</SelectItem>
                      {counterpartyOptions.map((cp) => (
                        <SelectItem key={cp.name} value={cp.name}>
                          {cp.name} ({cp.txCount}x, ${Math.round(cp.totalAmount).toLocaleString()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteIndex(index)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={addMember}>
          <Plus className="size-4 mr-1" />
          Add Member
        </Button>
        <Button variant="outline" onClick={handleAutoDetect} disabled={detecting}>
          <Wand2 className="size-4 mr-1" />
          {detecting ? "Detecting..." : "Auto-detect Counterparties"}
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="size-4 mr-1" />
          {saving ? "Saving..." : "Save All"}
        </Button>
      </div>

      <AlertDialog open={deleteIndex !== null} onOpenChange={(open) => !open && setDeleteIndex(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteIndex !== null && members[deleteIndex]
                ? `"${members[deleteIndex].name || "Unnamed member"}" will be removed. Save to persist the change.`
                : "This team member will be removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteIndex !== null) removeMember(deleteIndex);
                setDeleteIndex(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
