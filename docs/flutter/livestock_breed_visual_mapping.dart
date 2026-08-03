import 'package:flutter/material.dart';

enum BreedBadgeKind { solid, split }

class BreedVisualOption {
  const BreedVisualOption({
    required this.label,
    required this.value,
    required this.kind,
    required this.primaryColor,
    this.secondaryColor,
    this.borderColor,
  });

  final String label;
  final String value;
  final BreedBadgeKind kind;
  final Color primaryColor;
  final Color? secondaryColor;
  final Color? borderColor;
}

const livestockCategoryLabels = <String, String>{
  'POULTRY_BROILER': 'Poultry (Meat)',
  'POULTRY_LAYER': 'Poultry (Eggs)',
  'CATTLE': 'Cattle / Livestock',
  'SHEEP_GOAT': 'Sheep / Goat',
  'PIG': 'Pig / Swine',
  'OTHER': 'Other / Generic',
};

const breedOptionsByCategory = <String, List<BreedVisualOption>>{
  'POULTRY_BROILER': [
    BreedVisualOption(
      label: 'White Broiler (Cobb 500 / Ross 308)',
      value: 'ross_308',
      kind: BreedBadgeKind.solid,
      primaryColor: Color(0xFFFDFBF7),
      borderColor: Color(0xFFB8B8B8),
    ),
  ],
  'POULTRY_LAYER': [
    BreedVisualOption(
      label: 'Brown Layer (ISA Brown / Lohmann)',
      value: 'isa_brown',
      kind: BreedBadgeKind.solid,
      primaryColor: Color(0xFFB3541E),
    ),
    BreedVisualOption(
      label: 'Black Layer (Bovans Black)',
      value: 'bovans_black',
      kind: BreedBadgeKind.solid,
      primaryColor: Color(0xFF222222),
    ),
  ],
  'CATTLE': [
    BreedVisualOption(
      label: 'Local Zebu / Sanga / White Fulani',
      value: 'local_zebu_sanga_white_fulani',
      kind: BreedBadgeKind.solid,
      primaryColor: Color(0xFFD2B48C),
    ),
    BreedVisualOption(
      label: 'Ndama / Brown Crosses',
      value: 'ndama_brown_crosses',
      kind: BreedBadgeKind.solid,
      primaryColor: Color(0xFF5C2C16),
    ),
  ],
  'SHEEP_GOAT': [
    BreedVisualOption(
      label: 'West African Dwarf (Local)',
      value: 'west_african_dwarf',
      kind: BreedBadgeKind.split,
      primaryColor: Color(0xFFFDFBF7),
      secondaryColor: Color(0xFF111111),
      borderColor: Color(0xFFC29160),
    ),
    BreedVisualOption(
      label: 'Sahelian / Northern Cross',
      value: 'sahelian_northern_cross',
      kind: BreedBadgeKind.solid,
      primaryColor: Color(0xFFFDFBF7),
      borderColor: Color(0xFFD2B48C),
    ),
  ],
  'PIG': [
    BreedVisualOption(
      label: 'Large White / Landrace',
      value: 'large_white',
      kind: BreedBadgeKind.solid,
      primaryColor: Color(0xFFF6C3C3),
    ),
    BreedVisualOption(
      label: 'Ashanti Black / Local Cross',
      value: 'ashanti_black_local_cross',
      kind: BreedBadgeKind.solid,
      primaryColor: Color(0xFF111111),
    ),
  ],
  'OTHER': [],
};

List<BreedVisualOption> breedOptionsForCategory(String? category) {
  return breedOptionsByCategory[category] ?? const [];
}

class BreedBadgeSquare extends StatelessWidget {
  const BreedBadgeSquare({super.key, required this.option});

  final BreedVisualOption option;

  @override
  Widget build(BuildContext context) {
    final border = Border.all(
      color: option.borderColor ?? Colors.white.withValues(alpha: 0.35),
      width: 1,
    );

    if (option.kind == BreedBadgeKind.split) {
      return Container(
        width: 16,
        height: 16,
        decoration: BoxDecoration(border: border),
        child: Row(
          children: [
            Expanded(child: ColoredBox(color: option.primaryColor)),
            Expanded(
              child: ColoredBox(
                color: option.secondaryColor ?? option.primaryColor,
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      width: 16,
      height: 16,
      decoration: BoxDecoration(color: option.primaryColor, border: border),
    );
  }
}

DropdownMenuItem<String> breedDropdownItem(BreedVisualOption option) {
  return DropdownMenuItem<String>(
    value: option.value,
    child: Row(
      children: [
        BreedBadgeSquare(option: option),
        const SizedBox(width: 8),
        Expanded(child: Text(option.label, overflow: TextOverflow.ellipsis)),
      ],
    ),
  );
}
