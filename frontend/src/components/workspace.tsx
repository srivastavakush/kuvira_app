import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Brand } from "./brand";
import { Button } from "./ui";
import { ErrorBanner } from "./states";
import { c } from "@/src/theme";

export function WorkspaceNav({
  items,
  active,
  onChange,
}: {
  items: { key: string; label: string }[];
  active: string;
  onChange: (key: any) => void;
}) {
  return (
    <ScrollView
      horizontal
      style={{ flexGrow: 0, flexShrink: 0 }}
      contentContainerStyle={{ padding: 12, gap: 8 }}
      showsHorizontalScrollIndicator={false}
    >
      {items.map((item) => (
        <Pressable
          key={item.key}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === item.key }}
          onPress={() => onChange(item.key)}
          style={[
            s.tab,
            active === item.key && {
              backgroundColor: c.text,
              borderColor: c.text,
            },
          ]}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "700",
              color: active === item.key ? "white" : c.text,
            }}
          >
            {item.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
export function WorkspaceHeading({
  title,
  subtitle,
  back,
}: {
  title: string;
  subtitle: string;
  back: () => void;
}) {
  return (
    <View style={s.heading}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={back}
        style={s.tab}
      >
        <Text style={{ fontSize: 22, color: c.text }}>←</Text>
      </Pressable>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Brand compact />
        <Text accessibilityRole="header" style={s.title}>
          {title}
        </Text>
        <Text style={s.meta}>{subtitle}</Text>
      </View>
    </View>
  );
}
export type Field = {
  key: string;
  label: string;
  required?: boolean;
  numeric?: boolean;
  multiline?: boolean;
  image?: boolean;
  options?: { value: string; label: string }[];
};
export function WorkspaceEditor({
  title,
  context,
  fields,
  initial = {},
  save,
  close,
}: {
  title: string;
  context: string;
  fields: Field[];
  initial?: Record<string, any>;
  save: (values: any) => Promise<any>;
  close: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map((f) => [f.key, String(initial[f.key] ?? "")]),
    ),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  async function submit() {
    setError(null);
    const payload: Record<string, any> = {};
    for (const f of fields) {
      const v = values[f.key]?.trim();
      if (f.required && !v) {
        setError(`Enter ${f.label.toLowerCase()}.`);
        return;
      }
      if (f.numeric && v && (!Number.isFinite(Number(v)) || Number(v) < 0)) {
        setError(`${f.label} must be a positive number or zero.`);
        return;
      }
      if (v) payload[f.key] = f.numeric ? Number(v) : v;
      else if (!f.numeric) payload[f.key] = "";
    }
    setBusy(true);
    try {
      await save(payload);
      close();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function pick(key: string) {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
        base64: true,
      });
      if (!result.canceled && result.assets[0]?.base64)
        setValues({
          ...values,
          [key]: `data:${result.assets[0].mimeType || "image/jpeg"};base64,${result.assets[0].base64}`,
        });
    } catch (e) {
      setError(e);
    }
  }
  return (
    <Modal
      transparent
      animationType="slide"
      onRequestClose={() => !busy && close()}
    >
      <SafeAreaView style={s.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={s.sheet}
        >
          <View
            style={{
              padding: 20,
              borderBottomWidth: 1,
              borderColor: "#E2E8F0",
            }}
          >
            <Text style={s.title}>{title}</Text>
            <Text style={s.meta}>{context}</Text>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 20, gap: 16 }}
          >
            <ErrorBanner error={error} />
            {fields.map((f) => (
              <View key={f.key} style={{ gap: 7 }}>
                <Text
                  style={{ color: c.text, fontWeight: "700", fontSize: 14 }}
                >
                  {f.label}
                  {f.required ? " *" : ""}
                </Text>
                {f.options ? (
                  <View
                    style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}
                  >
                    {f.options.map((o) => (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{
                          checked: values[f.key] === o.value,
                        }}
                        key={o.value}
                        onPress={() =>
                          setValues({ ...values, [f.key]: o.value })
                        }
                        style={[
                          s.tab,
                          values[f.key] === o.value && {
                            backgroundColor: "#D8FF27",
                          },
                        ]}
                      >
                        <Text style={{ color: c.text }}>{o.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <TextInput
                    accessibilityLabel={f.label}
                    value={
                      f.image && values[f.key]?.startsWith("data:")
                        ? ""
                        : values[f.key]
                    }
                    placeholder={
                      f.image && values[f.key]?.startsWith("data:")
                        ? "Photo selected — paste a URL to replace"
                        : undefined
                    }
                    onChangeText={(v) => setValues({ ...values, [f.key]: v })}
                    keyboardType={f.numeric ? "decimal-pad" : "default"}
                    multiline={f.multiline}
                    autoCapitalize="none"
                    style={[
                      s.input,
                      f.multiline && {
                        minHeight: 100,
                        textAlignVertical: "top",
                      },
                    ]}
                  />
                )}
                {f.image && (
                  <>
                    <Button
                      label={values[f.key] ? "Change photo" : "Choose photo"}
                      variant="secondary"
                      onPress={() => pick(f.key)}
                    />
                    {values[f.key] ? (
                      <Image
                        source={{ uri: values[f.key] }}
                        style={{ height: 140, width: "100%", borderRadius: 12 }}
                        contentFit="cover"
                      />
                    ) : null}
                  </>
                )}
              </View>
            ))}
          </ScrollView>
          <View
            style={{
              padding: 16,
              flexDirection: "row",
              gap: 12,
              borderTopWidth: 1,
              borderColor: "#E2E8F0",
            }}
          >
            <View style={{ flex: 1 }}>
              <Button
                label="Cancel"
                variant="secondary"
                disabled={busy}
                onPress={close}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="Save changes" loading={busy} onPress={submit} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
export function DataRows({
  rows,
  columns,
  actions,
  empty = "Nothing here yet.",
}: {
  rows: any[];
  columns: { key: string; label: string; render?: (row: any) => any }[];
  actions?: (row: any) => React.ReactNode;
  empty?: string;
}) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  return (
    <View style={{ gap: 10 }}>
      {wide && rows.length > 0 && (
        <View style={s.dataRow}>
          {columns.map((col) => (
            <Text key={col.key} style={[s.cell, { fontWeight: "800" }]}>
              {col.label}
            </Text>
          ))}
          {actions && (
            <Text style={[s.cell, { fontWeight: "800" }]}>Actions</Text>
          )}
        </View>
      )}
      {!rows.length && (
        <View style={s.card}>
          <Text style={s.meta}>{empty}</Text>
        </View>
      )}
      {rows.map((row, i) => (
        <View
          key={row.id || row.user_id || i}
          style={[s.card, wide && s.dataRow]}
        >
          {columns.map((col) => (
            <View key={col.key} style={wide ? s.cell : { gap: 3 }}>
              {!wide && (
                <Text style={{ color: c.textSecondary, fontSize: 12 }}>
                  {col.label}
                </Text>
              )}
              <Text
                selectable
                style={{ color: c.text, fontSize: 14, flexShrink: 1 }}
              >
                {String(col.render ? col.render(row) : (row[col.key] ?? "—"))}
              </Text>
            </View>
          ))}
          {actions && (
            <View
              style={[
                wide ? s.cell : {},
                { flexDirection: "row", flexWrap: "wrap", gap: 8 },
              ]}
            >
              {actions(row)}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}
export const workspaceStyles = safeStyles();
function safeStyles() {
  return StyleSheet.create({
    content: {
      width: "100%",
      maxWidth: 1280,
      alignSelf: "center",
      padding: 16,
      paddingBottom: 48,
      gap: 16,
    },
  });
}
const s = StyleSheet.create({
  heading: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "white",
  },
  title: { fontSize: 24, fontWeight: "900", color: c.text, marginTop: 8 },
  meta: { color: c.textSecondary, fontSize: 14, lineHeight: 21 },
  tab: {
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    justifyContent: "center",
    backgroundColor: "white",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(8,28,43,.5)",
    justifyContent: "center",
    padding: 12,
  },
  sheet: {
    width: "100%",
    maxWidth: 640,
    maxHeight: "95%",
    alignSelf: "center",
    backgroundColor: "white",
    borderRadius: 24,
    overflow: "hidden",
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 12,
    minHeight: 48,
    padding: 12,
    color: c.text,
    fontSize: 16,
    backgroundColor: "#F8FAFC",
  },
  card: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  dataRow: { flexDirection: "row", gap: 16, padding: 16, alignItems: "center" },
  cell: { flex: 1, minWidth: 0, color: c.text },
});
