"use client";

import { Badge } from "@sanarwa/ui/badge";
import { Button } from "@sanarwa/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@sanarwa/ui/card";
import { Label } from "@sanarwa/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@sanarwa/ui/select";
import { Slider } from "@sanarwa/ui/slider";
import { Textarea } from "@sanarwa/ui/textarea";
import type { TemplateVariable } from "@/lib/types/template";
import {
  ClockIcon,
  PauseIcon,
  PhoneIcon,
  PlayIcon,
  UserIcon,
  SpeakerWaveIcon,
  LanguageIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useRef, useState } from "react";

interface VoiceTemplateEditorProps {
  script?: string;
  variables?: TemplateVariable[];
  onChange?: (value: string) => void;
}

type VoiceGender = "male" | "female" | "neutral";
type VoiceLanguage = "en-US" | "en-GB" | "es-ES" | "fr-FR" | "de-DE" | "it-IT" | "pt-BR" | "ja-JP";

export function VoiceTemplateEditor({
  script = "",
  variables = [],
  onChange,
}: VoiceTemplateEditorProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [voiceGender, setVoiceGender] = useState<VoiceGender>("female");
  const [voiceLanguage, setVoiceLanguage] = useState<VoiceLanguage>("en-US");
  const [speechRate, setSpeechRate] = useState([1]);
  const [speechPitch, setSpeechPitch] = useState([1]);
  const [speechVolume, setSpeechVolume] = useState([1]);
  const [estimatedDuration, setEstimatedDuration] = useState(0);
  const speechSynthesisRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    const wordCount = script.trim().split(/\s+/).length;
    const rate = speechRate[0] || 1;
    const wordsPerMinute = 150 / rate;
    const duration = (wordCount / wordsPerMinute) * 60;
    setEstimatedDuration(Math.round(duration));
  }, [script, speechRate]);

  const insertVariable = (variable: string) => {
    const variableText = `{{${variable}}}`;
    onChange?.(script + variableText);
  };

  const insertPause = (duration: string) => {
    const pauseText = `[PAUSE ${duration}]`;
    onChange?.(script + pauseText);
  };

  const insertEmphasis = (text: string) => {
    const emphasisText = `[EMPHASIS]${text}[/EMPHASIS]`;
    onChange?.(script + emphasisText);
  };

  const playPreview = () => {
    if ("speechSynthesis" in window) {
      if (isPlaying) {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
        return;
      }

      const cleanScript = script
        .replace(/\[PAUSE \d+s?\]/g, " ... ")
        .replace(/\[EMPHASIS\](.*?)\[\/EMPHASIS\]/g, "$1")
        .replace(/\{\{.*?\}\}/g, "sample value");

      const utterance = new SpeechSynthesisUtterance(cleanScript);

      utterance.rate = speechRate[0] || 1;
      utterance.pitch = speechPitch[0] || 1;
      utterance.volume = speechVolume[0] || 1;
      utterance.lang = voiceLanguage;

      const voices = window.speechSynthesis.getVoices();
      const languagePrefix = voiceLanguage?.split("-")[0] || "en";
      const preferredVoice = voices.find(
        (voice) =>
          voice.lang.startsWith(languagePrefix) &&
          (voiceGender === "neutral" || voice.name.toLowerCase().includes(voiceGender)),
      );

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);

      speechSynthesisRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  };

  const languageOptions = [
    { value: "en-US", label: "English (US)" },
    { value: "en-GB", label: "English (UK)" },
    { value: "es-ES", label: "Spanish" },
    { value: "fr-FR", label: "French" },
    { value: "de-DE", label: "German" },
    { value: "it-IT", label: "Italian" },
    { value: "pt-BR", label: "Portuguese (Brazil)" },
    { value: "ja-JP", label: "Japanese" },
  ];

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label htmlFor="voiceScript">Voice Script</Label>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              <ClockIcon className="h-3 w-3 mr-1" />~{formatDuration(estimatedDuration)}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={playPreview}
              disabled={!script.trim()}
            >
              {isPlaying ? (
                <>
                  <PauseIcon className="h-4 w-4 mr-2" />
                  Stop Preview
                </>
              ) : (
                <>
                  <PlayIcon className="h-4 w-4 mr-2" />
                  Play Preview
                </>
              )}
            </Button>
          </div>
        </div>
        <Textarea
          id="voiceScript"
          value={script}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder="Write your voice script here. Use natural language and include pauses where needed..."
          rows={12}
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Write naturally as if speaking to someone. The system will convert this to speech.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            Voice Settings
          </CardTitle>
          <CardDescription>Configure the voice characteristics for your call</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Language</Label>
              <Select
                value={voiceLanguage}
                onValueChange={(value: VoiceLanguage) => setVoiceLanguage(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languageOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <LanguageIcon className="h-4 w-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Voice Gender</Label>
              <Select
                value={voiceGender}
                onValueChange={(value: VoiceGender) => setVoiceGender(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Speech Rate</Label>
                <span className="text-sm text-muted-foreground">{speechRate[0]}x</span>
              </div>
              <Slider
                value={speechRate}
                onValueChange={setSpeechRate}
                min={0.5}
                max={2}
                step={0.1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Adjust how fast the voice speaks (0.5x = slow, 2x = fast)
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Speech Pitch</Label>
                <span className="text-sm text-muted-foreground">{speechPitch[0]}x</span>
              </div>
              <Slider
                value={speechPitch}
                onValueChange={setSpeechPitch}
                min={0.5}
                max={2}
                step={0.1}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Adjust the voice pitch (0.5x = lower, 2x = higher)
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="flex items-center gap-2">
                  <SpeakerWaveIcon className="h-4 w-4" />
                  Volume
                </Label>
                <span className="text-sm text-muted-foreground">
                  {Math.round((speechVolume[0] || 1) * 100)}%
                </span>
              </div>
              <Slider
                value={speechVolume}
                onValueChange={setSpeechVolume}
                min={0.1}
                max={1}
                step={0.1}
                className="w-full"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Script Enhancement</CardTitle>
          <CardDescription>Add special formatting and variables to your script</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {variables.length > 0 && (
            <div>
              <Label className="mb-2 block">Insert Variables</Label>
              <div className="flex flex-wrap gap-2">
                {variables.map((variable) => (
                  <Button
                    key={variable.name}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => insertVariable(variable.name)}
                    className="text-xs"
                    title={variable.description}
                  >
                    {variable.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label className="mb-2 block">Insert Pauses</Label>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => insertPause("1s")}>
                Short Pause (1s)
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => insertPause("2s")}>
                Medium Pause (2s)
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => insertPause("3s")}>
                Long Pause (3s)
              </Button>
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Common Phrases</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange?.(script + "Hello, this is a call from ")}
              >
                Greeting
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange?.(script + "Thank you for your time. ")}
              >
                Thank You
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  onChange?.(script + "Please press 1 to continue or 2 to speak with an agent. ")
                }
              >
                Menu Options
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onChange?.(script + "Have a great day! ")}
              >
                Closing
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneIcon className="h-4 w-4" />
            Call Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white">
                  <PhoneIcon className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-medium">Outgoing Call</div>
                  <div className="text-sm text-muted-foreground">
                    {voiceLanguage} • {voiceGender} voice
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">Estimated Duration</div>
                <div className="text-lg font-bold">{formatDuration(estimatedDuration)}</div>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="text-sm font-medium mb-2">Script Preview:</div>
              <div className="bg-white rounded p-3 text-sm max-h-32 overflow-y-auto">
                {script || "No script content yet..."}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Voice Call Best Practices</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• Keep calls under 2 minutes for better engagement</li>
            <li>• Start with a clear identification of your business</li>
            <li>• Use natural, conversational language</li>
            <li>• Include pauses for better comprehension</li>
            <li>• Provide clear next steps or call-to-action</li>
            <li>• Test with different voice settings for your audience</li>
            <li>• Always include opt-out instructions</li>
            <li>• Consider time zones when scheduling calls</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
