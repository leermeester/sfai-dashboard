"use client";

import { useState } from "react";
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
import { Plus, Save, Trash2 } from "lucide-react";

interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  role: string;
  hourlyRate: number | null;
  monthlyCost: number | null;
  isActive: boolean;
  linearUserId: string | null;
}

export function TeamConfigForm({
  members: initialMembers,
}: {
  members: TeamMember[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [saving, setSaving] = useState(false);

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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMember(index)}
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
        <Button onClick={handleSave} disabled={saving}>
          <Save className="size-4 mr-1" />
          {saving ? "Saving..." : "Save All"}
        </Button>
      </div>
    </div>
  );
}
