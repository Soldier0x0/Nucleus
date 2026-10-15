import { useEffect, useState } from "react";
import { Share, TextInput, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { useStore } from "@/src/core/store";
import { useTheme } from "@/src/theme";
import { addMonths, money, monthKey, todayISO } from "@/src/core/format";
import { readiness } from "@/src/core/domains";
import { isJourneyTrip } from "@/src/core/transit";
import { channelSeries } from "@/src/core/intelligence";
import { balanceOverTime, categorySplit, dayBefore, grewMost, monthFlow, priceChange, repeatingBills, unusedCategories } from "@/src/core/moneyDesk";
import { memoryKey, type BankAsk } from "@/src/core/smsMoney";
import { suggestShared } from "@/src/core/recordLinks";
import { shareBill } from "@/src/core/shareLine";
import { ChannelBars, compactValue } from "./charts";
import { syncBankInbox } from "./BankTextSync";
import { Button, Card, Eyebrow, IconButton, Press, T } from "./ui";
import { useToast } from "./Toast";

/** Charts, bills, bank texts, and links. Visible on Money, not behind another tap. */
export function MoneyDesk({ month }: { month: string }) {
  const { db, update, setSettings } = useStore();
  const router = useRouter();
  const { colors, sp } = useTheme();
  const { width } = useWindowDimensions();
  const [person, setPerson] = useState("");
  const [account, setAccount] = useState("");
  const [asks, setAsks] = useState<BankAsk[]>([]);
  const [readNote, setReadNote] = useState("");
  const [numbers, setNumbers] = useState(false);
  const toast = useToast();
  const chartW = Math.min(width, 720) - sp.lg * 2 - 34;
  const chartFmt = db.settings.privacyMode ? () => "•••" : compactValue;
  const flow = monthFlow(db.txns, month);
  const journeys = db.trips.filter(isJourneyTrip).filter((trip) => trip.end >= todayISO()).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 3);
  const channels = channelSeries(db, 6);
  const split = categorySplit(db.txns, month);
  const previousMonth = addMonths(`${month}-01`, -1).slice(0, 7);
  const grew = grewMost(db.txns, month, previousMonth);
  const balances = balanceOverTime(db.txns.filter((row) => row.date.slice(0, 7) === month));
  const bills = repeatingBills(db.txns);
  const unused = unusedCategories(db.settings.moneyNames, db.txns);
  const links = suggestShared({
    debits: db.txns.filter((row) => row.type === "expense" && !row.transfer && !row.photo).map((row) => ({ id: row.id, date: row.date, amount: row.amount })),
    receipts: db.txns.filter((row) => row.photo).map((row) => ({ id: row.id, date: row.date, amount: row.amount })),
    trips: db.trips.map((trip) => ({ id: trip.id, start: trip.start, end: trip.end })),
    fuel: db.fuel.map((fill) => ({ id: fill.id, date: fill.date, total: fill.total })),
    periods: db.cycle.days.filter((day) => day.bleeding === "flow").map((day) => ({ id: day.id, date: day.date })),
    missedWork: db.notes.filter((note) => /missed work/i.test(`${note.title} ${note.body}`)).map((note) => ({ id: note.id, date: note.createdAt.slice(0, 10) })),
  });
  const remember = (ask: BankAsk, choice: "category" | "transfer" | "ignore") => {
    const key = memoryKey(ask.sender);
    const next = db.settings.smsMemory.filter((row) => row.key !== key);
    const category = choice === "transfer" ? "Transfer" : choice === "category" ? ask.category : undefined;
    setSettings({ smsMemory: [...next, { key, choice, category }] });
    if (choice === "ignore" || !ask.date) return;
    update((d) => {
      if (d.txns.some((row) => row.id === ask.id)) return d;
      return {
        ...d,
        txns: [...d.txns, {
          id: ask.id,
          type: ask.kind === "credit" && choice !== "transfer" ? "income" as const : "expense" as const,
          amount: ask.kind === "balance" ? 0 : ask.amount,
          category: choice === "transfer" ? "Transfer" : ask.category,
          date: ask.date,
          note: ask.sender,
          transfer: choice === "transfer",
          ...(ask.kind === "balance" ? { balance: ask.amount } : {}),
        }],
      };
    });
    setAsks((rows) => rows.filter((row) => row.id !== ask.id));
  };

  const readBank = async () => {
    const result = await syncBankInbox(db, update);
    setAsks(result.asks);
    setReadNote(`${result.kept} bank lines kept. ${result.dropped} dropped on this phone.`);
  };

  useEffect(() => {
    if (!db.settings.smsInbox) return;
    readBank().catch(() => {});
  }, [db.settings.smsInbox]);

  return (
    <>
      <Card testID="money-flow-card">
        <Eyebrow>This month</Eyebrow>
        <T v="h2" style={{ marginTop: 6 }} testID="money-flow-out">Out {flow.out}</T>
        <T testID="money-flow-in">In {flow.in}</T>
        <T muted style={{ marginTop: 6 }}>Transfers between your own accounts are not spending. Cash is.</T>
      </Card>
      <Card testID="money-split-card">
        <Eyebrow>Category split</Eyebrow>
        {split.length === 0 ? <T muted style={{ marginTop: 6 }}>No spending this month.</T> : split.map((row) => (
          <T key={row.category} style={{ marginTop: 6 }}>{row.category} · {row.amount}</T>
        ))}
      </Card>
      <Card testID="money-journeys-card">
        <Eyebrow>Journeys</Eyebrow>
        {journeys.length === 0 ? (
          <T muted style={{ marginTop: 6 }}>Trips live here now. Add one and its spend shows beside it.</T>
        ) : (
          journeys.map((trip) => {
            const r = readiness(db, trip);
            const packed = trip.packing.length ? `${trip.packing.filter((item) => item.done).length}/${trip.packing.length} packed · ` : "";
            return (
              <Press key={trip.id} testID={`money-journey-${trip.id}`} onPress={() => router.push(`/travel/${trip.id}`)} style={{ marginTop: 8 }}>
                <T v="label">{trip.name}</T>
                <T muted>{trip.start} → {trip.end} · {packed}{db.settings.privacyMode ? "•••" : money(r.spent, db.settings.currency, { decimals: false })} spent</T>
              </Press>
            );
          })
        )}
        <Button small kind="secondary" icon="bag-suitcase-outline" label="Open journeys" testID="money-journeys-open" style={{ marginTop: 10 }} onPress={() => router.push("/travel")} />
      </Card>
      <Press testID="money-channel-toggle" onPress={() => setNumbers((v) => !v)}>
        <Card testID="money-channel-card">
          <Eyebrow>Online vs in person · last 6 months</Eyebrow>
          <View style={{ flexDirection: "row", gap: 14, marginTop: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.info }} />
              <T muted style={{ fontSize: 12 }}>Online</T>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success }} />
              <T muted style={{ fontSize: 12 }}>In person</T>
            </View>
          </View>
          <ChannelBars data={channels.map((row) => ({ label: row.label, online: row.online, inPerson: row.inPerson }))} width={chartW} showValues={numbers} format={chartFmt} testID="money-channel-bars" />
          <T muted style={{ fontSize: 11, marginTop: 6 }}>Only tagged spends are counted. {numbers ? "Tap to hide amounts" : "Tap for amounts"}.</T>
        </Card>
      </Press>
      <Card testID="money-grew-card">
        <Eyebrow>Since last month</Eyebrow>
        <T style={{ marginTop: 6 }}>{grew ? grew.line : "No category grew from last month."}</T>
        <Button small kind="secondary" label="Open gallery" testID="money-open-gallery" onPress={() => router.push("/gallery")} style={{ marginTop: 8 }} />
      </Card>
      <Card testID="money-balance-card">
        <Eyebrow>Balance over time</Eyebrow>
        {balances.length === 0 ? <T muted style={{ marginTop: 6 }}>No lines this month.</T> : balances.slice(-6).map((point) => (
          <T key={`${point.date}-${point.balance}`} style={{ marginTop: 4 }}>{point.date} · {point.balance}</T>
        ))}
      </Card>
      <Card testID="money-bills-card">
        <Eyebrow>Repeating bills</Eyebrow>
        <TextInput testID="money-share-person" value={person} onChangeText={setPerson} placeholder="One person" placeholderTextColor={colors.muted} style={{ marginTop: 8, height: 44, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 12, color: colors.onSurface }} />
        {bills.length === 0 ? <T muted style={{ marginTop: 8 }}>A bill that shows up in two months is listed here, with a reminder the day before.</T> : null}
        {bills.map((bill) => {
          const change = priceChange(db.txns, bill.name);
          return (
            <View key={bill.name} style={{ marginTop: 10 }}>
              <T v="label">{bill.name}</T>
              <T muted>Next {bill.next}. Reminder {dayBefore(bill.next)}.{change?.changed ? ` Price changed from ${change.previous} to ${change.latest}.` : ""}</T>
              <Button small kind="secondary" label={`Hand ${bill.name} to ${person || "someone"}`} testID={`money-share-${bill.name}`} disabled={!person.trim()} onPress={() => person && Share.share({ message: shareBill(person, { name: bill.name, amount: bill.amount }) })} style={{ marginTop: 6 }} />
            </View>
          );
        })}
      </Card>
      <Card testID="money-names-card">
        <Eyebrow>Named categories</Eyebrow>
        <T muted style={{ marginTop: 6 }}>{db.settings.moneyNames.length ? db.settings.moneyNames.join(", ") : "Name a category and it stays on the list."}</T>
        {unused.map((name) => (
          <Button key={name} small kind="ghost" label={`Remove ${name}`} testID={`money-remove-${name}`} onPress={() => { setSettings({ moneyNames: db.settings.moneyNames.filter((item) => item !== name) }); toast("Name removed", "tag-outline"); }} style={{ marginTop: 6 }} />
        ))}
        <Button small kind="secondary" label="Add the categories you have used" testID="money-add-names" onPress={() => setSettings({ moneyNames: Array.from(new Set([...db.settings.moneyNames, ...db.txns.map((row) => row.category)])).slice(0, 40) })} style={{ marginTop: 8 }} />
      </Card>
      <Card testID="money-links-card">
        <Eyebrow>Linked records</Eyebrow>
        <T muted style={{ marginTop: 6 }}>A bank debit and a receipt, a trip and a fuel stop, or a logged period and a missed work day, when they share a date or an amount.</T>
        {links.map((link) => (
          <T key={`${link.fromId}-${link.toId}`} style={{ marginTop: 6 }}>{link.fromKind} {link.fromId} · {link.toKind} {link.toId} · {link.because}</T>
        ))}
      </Card>
      {db.settings.smsInbox ? (
        <Card testID="money-sms-card">
          <Eyebrow>Bank texts</Eyebrow>
          <T muted style={{ marginTop: 6 }}>Debit, credit, and balance lines stay on this phone. Codes and other texts are dropped. Nothing is uploaded.</T>
          <TextInput testID="money-own-account" value={account} onChangeText={setAccount} placeholder="Your account ending" placeholderTextColor={colors.muted} style={{ marginTop: 8, height: 44, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 8, paddingHorizontal: 12, color: colors.onSurface }} />
          <Button small kind="secondary" label="Remember this account" testID="money-save-account" onPress={() => {
            const ending = account.trim();
            if (ending.length < 3) { toast("Add at least 3 digits"); return; }
            if (db.settings.ownAccounts.includes(ending)) { toast("Already saved"); return; }
            setSettings({ ownAccounts: [...db.settings.ownAccounts, ending].slice(0, 12) });
            setAccount("");
          }} style={{ marginTop: 8 }} />
          {db.settings.ownAccounts.map((own, index) => (
            <View key={own} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
              <T muted>Account ending {own}</T>
              <IconButton icon="close" label={`Forget account ending ${own}`} testID={`bank-account-remove-${index}`} onPress={() => { setSettings({ ownAccounts: db.settings.ownAccounts.filter((item) => item !== own) }); toast(`Forgot account ending ${own}`, "bank-outline"); }} />
            </View>
          ))}
          <Button small label="Check bank texts" testID="money-read-sms" onPress={readBank} style={{ marginTop: 8 }} />
          {readNote ? <T style={{ marginTop: 8 }}>{readNote}</T> : null}
          {asks.map((ask) => (
            <View key={ask.id} style={{ marginTop: 10 }}>
              <T v="label">{ask.sender}</T>
              <T muted>{ask.notification.title}</T>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                <Button small label="Keep" testID={`sms-keep-${ask.sender}`} onPress={() => remember(ask, "category")} />
                <Button small kind="secondary" label="Own transfer" testID={`sms-transfer-${ask.sender}`} onPress={() => remember(ask, "transfer")} />
                <Button small kind="ghost" label="Ignore" testID={`sms-ignore-${ask.sender}`} onPress={() => remember(ask, "ignore")} />
              </View>
            </View>
          ))}
        </Card>
      ) : null}
    </>
  );
}

export function moneyMonth(today = todayISO()) {
  return monthKey(today);
}
