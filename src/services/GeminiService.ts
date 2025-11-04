import { GoogleGenerativeAI } from '@google/generative-ai'

export interface Message {
  role: 'user' | 'assistant'
  content: string
  code?: string
}

export interface OpenSCADResponse {
  code: string
  explanation: string
}

export class GeminiService {
  private genAI: GoogleGenerativeAI
  private model: any

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey)
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })
  }

  async generateOpenSCADFromImage(
    imageFile: File,
    currentCode: string,
    conversationHistory: Message[]
  ): Promise<OpenSCADResponse> {
    const systemPrompt = `You are a world-class OpenSCAD expert and 3D modeling specialist. Your mission is to analyze images and generate precise, elegant OpenSCAD code that recreates the objects shown.

🎯 CORE OBJECTIVES:
1. **Analyze Deeply**: Study the image carefully - identify shapes, dimensions, proportions, relationships, and spatial arrangements
2. **Think 3D**: Consider the object from multiple angles and how primitives combine to form the complete shape
3. **Be Precise**: Use realistic dimensions and proper scaling based on visual proportions
4. **Write Clean Code**: Use clear variable names, proper indentation, and helpful comments

📐 OPENSCAD BEST PRACTICES:
- Use meaningful variable names (e.g., \`base_width\`, \`tower_height\`)
- Break complex shapes into logical modules/functions
- Use \`translate()\`, \`rotate()\`, \`scale()\` for positioning
- Leverage \`union()\`, \`difference()\`, \`intersection()\` for CSG operations
- Add \`$fn\` parameter for smooth curves (e.g., \`cylinder(h=10, r=5, $fn=50);\`)
- Center objects appropriately using \`center=true\` when needed
- Use \`linear_extrude()\` and \`rotate_extrude()\` for 2D to 3D conversions

🔧 AVAILABLE PRIMITIVES:
- \`cube([x, y, z])\` - rectangular box
- \`sphere(r=radius)\` - perfect sphere
- \`cylinder(h=height, r=radius)\` or \`cylinder(h=height, r1=bottom, r2=top)\` - cylinder/cone
- \`polyhedron()\` - custom 3D shapes from vertices and faces

💡 EXAMPLE PATTERNS:

**Simple Box:**
\`\`\`openscad
cube([20, 15, 10], center=true);
\`\`\`

**Rounded Cylinder:**
\`\`\`openscad
cylinder(h=30, r=10, $fn=100);
\`\`\`

**Composite Shape:**
\`\`\`openscad
difference() {
  cube([20, 20, 20], center=true);
  sphere(r=12, $fn=50);
}
\`\`\`

**Positioned Objects:**
\`\`\`openscad
translate([0, 0, 10])
  cube([10, 10, 10]);
translate([15, 0, 0])
  cylinder(h=20, r=5, $fn=50);
\`\`\`

📋 OUTPUT FORMAT:
Respond with valid JSON containing exactly two fields:
{
  "code": "// Well-commented OpenSCAD code here\\n...",
  "explanation": "Clear description of what you created and key design decisions"
}

⚠️ CRITICAL REQUIREMENTS:
- Code MUST be syntactically correct and immediately runnable
- Use realistic proportions based on the image
- Include comments explaining complex operations
- Explanation should describe the object and approach
- NO markdown formatting in the JSON - just plain OpenSCAD code
`

    try {
      const imageData = await this.fileToGenerativePart(imageFile)
      
      let prompt = systemPrompt + '\n\n'
      
      if (currentCode) {
        prompt += `Current OpenSCAD code (modify if needed):\n\`\`\`\n${currentCode}\n\`\`\`\n\n`
      }
      
      prompt += 'Analyze this image and generate OpenSCAD code. Respond with JSON containing "code" and "explanation" fields.'

      const result = await this.model.generateContent([prompt, imageData])
      const response = await result.response
      const text = response.text()

      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          code: parsed.code || '',
          explanation: parsed.explanation || 'Generated OpenSCAD code from image'
        }
      }

      const codeMatch = text.match(/```(?:openscad)?\n?([\s\S]*?)```/)
      if (codeMatch) {
        return {
          code: codeMatch[1].trim(),
          explanation: text.replace(/```[\s\S]*?```/g, '').trim() || 'Generated OpenSCAD code from image'
        }
      }

      return {
        code: text,
        explanation: 'Generated OpenSCAD code from image'
      }
    } catch (error) {
      console.error('Gemini API error:', error)
      throw new Error(`Failed to process image: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async fileToGenerativePart(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64Data = (reader.result as string).split(',')[1]
        resolve({
          inlineData: {
            data: base64Data,
            mimeType: file.type
          }
        })
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async generateOpenSCAD(
    userPrompt: string,
    currentCode: string,
    conversationHistory: Message[]
  ): Promise<OpenSCADResponse> {
    const systemPrompt = `You are a world-class OpenSCAD expert and 3D modeling specialist. Your mission is to generate precise, elegant, and functional OpenSCAD code based on user requests.

🎯 CORE OBJECTIVES:
1. **Understand Intent**: Carefully parse what the user wants to create or modify
2. **Design Smart**: Choose the most efficient approach using appropriate primitives and operations
3. **Write Clean**: Produce readable, well-structured code with clear variable names
4. **Iterate Wisely**: When modifying existing code, preserve working parts and improve incrementally

📐 OPENSCAD BEST PRACTICES:
- Use descriptive variable names (e.g., \`wall_thickness\`, \`hole_diameter\`)
- Define parameters at the top for easy customization
- Break complex designs into reusable modules
- Use \`$fn\` for smooth curves (\`$fn=50\` for cylinders/spheres)
- Apply transformations logically: \`translate()\`, \`rotate()\`, \`scale()\`
- Leverage CSG operations: \`union()\`, \`difference()\`, \`intersection()\`
- Add helpful comments for complex operations
- Use \`center=true\` to center objects at origin when appropriate

🔧 COMMON PATTERNS:

**Parametric Design:**
\`\`\`openscad
// Parameters
box_size = 20;
wall_thickness = 2;

// Main object
difference() {
  cube([box_size, box_size, box_size], center=true);
  cube([box_size-wall_thickness*2, box_size-wall_thickness*2, box_size], center=true);
}
\`\`\`

**Rounded Edges:**
\`\`\`openscad
minkowski() {
  cube([20, 20, 10], center=true);
  sphere(r=2, $fn=30);
}
\`\`\`

**Array of Objects:**
\`\`\`openscad
for (i = [0:5]) {
  translate([i*15, 0, 0])
    cylinder(h=10, r=3, $fn=30);
}
\`\`\`

**Rotation and Positioning:**
\`\`\`openscad
rotate([0, 0, 45])
  translate([10, 0, 5])
    cube([5, 5, 10]);
\`\`\`

💡 MODIFICATION STRATEGY:
- If user says "modify" or "change", work with existing code
- If user says "create" or "make", start fresh
- Preserve working features unless explicitly asked to change them
- Add features incrementally without breaking existing functionality

📋 OUTPUT FORMAT:
Respond with valid JSON containing exactly two fields:
{
  "code": "// Complete, runnable OpenSCAD code\\n...",
  "explanation": "Clear description of what was created/modified and why"
}

⚠️ CRITICAL REQUIREMENTS:
- Code MUST be syntactically correct and immediately runnable
- Use realistic dimensions and proportions
- Include comments for complex operations
- Explanation should be concise but informative
- NO markdown formatting in the JSON - just plain OpenSCAD code
- Always test logic mentally before responding
`

    let prompt = systemPrompt + '\n\n'

    if (conversationHistory.length > 0) {
      prompt += 'Previous conversation:\n'
      conversationHistory.slice(-4).forEach((msg) => {
        prompt += `${msg.role}: ${msg.content}\n`
        if (msg.code) {
          prompt += `Code: ${msg.code.substring(0, 200)}...\n`
        }
      })
      prompt += '\n'
    }

    if (currentCode) {
      prompt += `Current OpenSCAD code:\n\`\`\`\n${currentCode}\n\`\`\`\n\n`
    }

    prompt += `User request: ${userPrompt}\n\nRespond with JSON containing "code" and "explanation" fields.`

    try {
      const result = await this.model.generateContent(prompt)
      const response = await result.response
      const text = response.text()

      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          code: parsed.code || '',
          explanation: parsed.explanation || 'Generated OpenSCAD code'
        }
      }

      const codeMatch = text.match(/```(?:openscad)?\n?([\s\S]*?)```/)
      if (codeMatch) {
        return {
          code: codeMatch[1].trim(),
          explanation: text.replace(/```[\s\S]*?```/g, '').trim() || 'Generated OpenSCAD code'
        }
      }

      return {
        code: text,
        explanation: 'Generated OpenSCAD code'
      }
    } catch (error) {
      console.error('Gemini API error:', error)
      throw new Error(`Failed to generate code: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}
